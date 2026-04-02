/*
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka.
 *
 * Floodilka is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Floodilka is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Floodilka. If not, see <https://www.gnu.org/licenses/>.
 */

use std::time::Duration;

use clickhouse::Client;
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{error, info};

use super::schemas::{CounterMetric, GaugeMetric, HistogramRaw};

pub enum BufferedMetric {
    Counter(CounterMetric),
    Gauge(GaugeMetric),
    Histogram(HistogramRaw),
}

#[derive(Clone)]
pub struct MetricBuffer {
    tx: mpsc::Sender<BufferedMetric>,
}

impl MetricBuffer {
    pub fn spawn(client: Client, flush_interval_secs: u64, max_size: usize) -> Self {
        let (tx, rx) = mpsc::channel::<BufferedMetric>(max_size * 2);

        tokio::spawn(flush_loop(client, rx, flush_interval_secs, max_size));

        info!(
            "Metric buffer started: flush every {}s or {} items",
            flush_interval_secs, max_size
        );

        Self { tx }
    }

    pub async fn send(&self, metric: BufferedMetric) {
        if let Err(e) = self.tx.try_send(metric) {
            error!("Metric buffer full, dropping metric: {}", e);
        }
    }
}

struct PendingBatch {
    counters: Vec<CounterMetric>,
    gauges: Vec<GaugeMetric>,
    histograms: Vec<HistogramRaw>,
}

impl PendingBatch {
    fn new() -> Self {
        Self {
            counters: Vec::new(),
            gauges: Vec::new(),
            histograms: Vec::new(),
        }
    }

    fn len(&self) -> usize {
        self.counters.len() + self.gauges.len() + self.histograms.len()
    }

    fn push(&mut self, metric: BufferedMetric) {
        match metric {
            BufferedMetric::Counter(m) => self.counters.push(m),
            BufferedMetric::Gauge(m) => self.gauges.push(m),
            BufferedMetric::Histogram(m) => self.histograms.push(m),
        }
    }

    fn take(&mut self) -> Self {
        Self {
            counters: std::mem::take(&mut self.counters),
            gauges: std::mem::take(&mut self.gauges),
            histograms: std::mem::take(&mut self.histograms),
        }
    }
}

async fn flush_loop(
    client: Client,
    mut rx: mpsc::Receiver<BufferedMetric>,
    flush_interval_secs: u64,
    max_size: usize,
) {
    let mut batch = PendingBatch::new();
    let mut ticker = interval(Duration::from_secs(flush_interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        let should_flush = tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(metric) => {
                        batch.push(metric);
                        batch.len() >= max_size
                    }
                    None => {
                        // Channel closed — flush remaining and exit
                        if batch.len() > 0 {
                            flush_batch(&client, batch.take()).await;
                        }
                        info!("Metric buffer shutting down");
                        return;
                    }
                }
            }
            _ = ticker.tick() => {
                batch.len() > 0
            }
        };

        if should_flush {
            flush_batch(&client, batch.take()).await;
        }
    }
}

async fn flush_batch(client: &Client, batch: PendingBatch) {
    let total = batch.len();
    let mut errors = 0;

    if !batch.counters.is_empty() {
        if let Err(e) = flush_table(client, "counters", &batch.counters).await {
            error!("Failed to flush {} counters: {}", batch.counters.len(), e);
            errors += 1;
        }
    }

    if !batch.gauges.is_empty() {
        if let Err(e) = flush_table(client, "gauges", &batch.gauges).await {
            error!("Failed to flush {} gauges: {}", batch.gauges.len(), e);
            errors += 1;
        }
    }

    if !batch.histograms.is_empty() {
        if let Err(e) = flush_table(client, "histogram_raw", &batch.histograms).await {
            error!(
                "Failed to flush {} histograms: {}",
                batch.histograms.len(),
                e
            );
            errors += 1;
        }
    }

    if errors == 0 {
        info!("Flushed {} metrics", total);
    }
}

async fn flush_table<T: clickhouse::Row + serde::Serialize>(
    client: &Client,
    table: &str,
    rows: &[T],
) -> anyhow::Result<()> {
    let mut insert = client.insert(table)?;
    for row in rows {
        insert.write(row).await?;
    }
    insert.end().await?;
    Ok(())
}
