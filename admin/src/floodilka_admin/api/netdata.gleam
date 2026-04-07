//// Copyright (C) 2026 Floodilka Contributors
////
//// This file is part of Floodilka.
////
//// Floodilka is free software: you can redistribute it and/or modify
//// it under the terms of the GNU Affero General Public License as published by
//// the Free Software Foundation, either version 3 of the License, or
//// (at your option) any later version.
////
//// Floodilka is distributed in the hope that it will be useful,
//// but WITHOUT ANY WARRANTY; without even the implied warranty of
//// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
//// GNU Affero General Public License for more details.
////
//// You should have received a copy of the GNU Affero General Public License
//// along with Floodilka. If not, see <https://www.gnu.org/licenses/>.

import envoy
import gleam/dynamic/decode
import gleam/float
import gleam/http/request
import gleam/httpc
import gleam/int
import gleam/json
import gleam/list

pub type ServerMetrics {
  ServerMetrics(
    cpu_usage: Float,
    ram_used_mb: Float,
    ram_total_mb: Float,
    ram_percent: Float,
    disk_used_gb: Float,
    disk_total_gb: Float,
    disk_percent: Float,
  )
}

pub fn get_prod_url() -> Result(String, Nil) {
  envoy.get("NETDATA_PROD_URL")
}

pub fn get_livekit_url() -> Result(String, Nil) {
  envoy.get("NETDATA_LIVEKIT_URL")
}

pub fn fetch_metrics(base_url: String) -> Result(ServerMetrics, Nil) {
  let cpu_result = fetch_chart(base_url, "system.cpu")
  let ram_result = fetch_chart(base_url, "system.ram")
  let disk_result = fetch_chart(base_url, "disk_space./")

  case cpu_result, ram_result {
    Ok(cpu_data), Ok(ram_data) -> {
      let cpu_usage = parse_cpu(cpu_data)
      let #(ram_used, ram_total, ram_pct) = parse_ram(ram_data)
      let #(disk_used, disk_total, disk_pct) = case disk_result {
        Ok(disk_data) -> parse_disk(disk_data)
        Error(_) -> #(0.0, 0.0, 0.0)
      }

      Ok(ServerMetrics(
        cpu_usage: cpu_usage,
        ram_used_mb: ram_used,
        ram_total_mb: ram_total,
        ram_percent: ram_pct,
        disk_used_gb: disk_used,
        disk_total_gb: disk_total,
        disk_percent: disk_pct,
      ))
    }
    _, _ -> Error(Nil)
  }
}

fn fetch_chart(
  base_url: String,
  chart: String,
) -> Result(#(List(String), List(Float)), Nil) {
  let url =
    base_url
    <> "/api/v1/data?chart="
    <> chart
    <> "&after=-1&points=1&format=json"

  let assert Ok(req) = request.to(url)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let decoder = {
        use labels <- decode.field(
          "labels",
          decode.list(decode.string),
        )
        use data <- decode.field(
          "data",
          decode.list(decode.list(float_or_int())),
        )
        decode.success(#(labels, data))
      }

      case json.parse(resp.body, decoder) {
        Ok(#(labels, [row, ..])) -> {
          let values = case row {
            [_, ..rest] -> rest
            _ -> []
          }
          Ok(#(drop_first(labels), values))
        }
        _ -> Error(Nil)
      }
    }
    _ -> Error(Nil)
  }
}

fn parse_cpu(data: #(List(String), List(Float))) -> Float {
  let #(_labels, values) = data
  let total = list.fold(values, 0.0, fn(acc, v) { acc +. v })
  let idle = case list.last(values) {
    Ok(v) -> v
    Error(_) -> 0.0
  }
  let usage = total -. idle
  float.min(100.0, float.max(0.0, usage))
}

fn parse_ram(
  data: #(List(String), List(Float)),
) -> #(Float, Float, Float) {
  let #(_labels, values) = data
  let total = list.fold(values, 0.0, fn(acc, v) { acc +. v })
  let used = case values {
    [_, v, ..] -> v
    _ -> 0.0
  }
  let pct = case total >. 0.0 {
    True -> used /. total *. 100.0
    False -> 0.0
  }
  #(used, total, pct)
}

fn parse_disk(
  data: #(List(String), List(Float)),
) -> #(Float, Float, Float) {
  let #(_labels, values) = data
  let total = list.fold(values, 0.0, fn(acc, v) { acc +. float.absolute_value(v) })
  let used = case values {
    [_, v, ..] -> float.absolute_value(v)
    _ -> 0.0
  }
  let pct = case total >. 0.0 {
    True -> used /. total *. 100.0
    False -> 0.0
  }
  #(used, total, pct)
}

fn drop_first(items: List(a)) -> List(a) {
  case items {
    [_, ..rest] -> rest
    _ -> []
  }
}

fn float_or_int() -> decode.Decoder(Float) {
  decode.one_of(decode.float, [
    decode.int |> decode.map(int.to_float),
  ])
}
