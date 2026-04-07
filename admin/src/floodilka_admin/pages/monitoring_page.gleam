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

import floodilka_admin/api/common
import floodilka_admin/api/netdata
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session}
import gleam/float
import gleam/int
import gleam/option
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Response}

pub fn view(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  flash_data: option.Option(flash.Flash),
) -> Response {
  let prod_metrics = case netdata.get_prod_url() {
    Ok(url) -> netdata.fetch_metrics(url)
    Error(_) -> Error(Nil)
  }

  let livekit_metrics = case netdata.get_livekit_url() {
    Ok(url) -> netdata.fetch_metrics(url)
    Error(_) -> Error(Nil)
  }

  let content =
    h.div([], [
      ui.flex_row_between([
        ui.heading_page("Мониторинг серверов"),
        h.div([a.class("text-xs text-neutral-400")], [
          element.text("Автообновление каждые 10 сек"),
        ]),
      ]),
      h.div([a.class("space-y-6")], [
        render_server_section("Прод сервер", prod_metrics),
        render_server_section("LiveKit сервер", livekit_metrics),
      ]),
    ])

  let html =
    layout.page_with_refresh(
      "Мониторинг серверов",
      "monitoring",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
      True,
    )
  wisp.html_response(element.to_document_string(html), 200)
}

fn render_server_section(
  title: String,
  metrics: Result(netdata.ServerMetrics, Nil),
) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm p-6")],
    [
      ui.heading_section(title),
      case metrics {
        Ok(m) ->
          h.div(
            [a.class("grid grid-cols-1 md:grid-cols-3 gap-4 mt-4")],
            [
              stat_card_with_progress(
                "CPU",
                float_to_string_1(m.cpu_usage) <> "%",
                "",
                float.round(m.cpu_usage),
              ),
              stat_card_with_progress(
                "Память",
                float_to_string_1(m.ram_used_mb) <> " MB",
                float_to_string_1(m.ram_total_mb) <> " MB всего",
                float.round(m.ram_percent),
              ),
              stat_card_with_progress(
                "Диск",
                float_to_string_1(m.disk_used_gb) <> " GB",
                float_to_string_1(m.disk_total_gb) <> " GB всего",
                float.round(m.disk_percent),
              ),
            ],
          )
        Error(_) ->
          h.div([a.class("mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-center")], [
            h.p([a.class("text-red-800 text-sm")], [
              element.text("Не удалось получить метрики. Проверьте переменные NETDATA_PROD_URL / NETDATA_LIVEKIT_URL"),
            ]),
          ])
      },
    ],
  )
}

fn stat_card_with_progress(
  label: String,
  value: String,
  sub: String,
  percentage: Int,
) {
  let bar_color = case percentage {
    p if p >= 80 -> "bg-red-500"
    p if p >= 50 -> "bg-yellow-500"
    _ -> "bg-green-500"
  }

  let text_color = case percentage {
    p if p >= 80 -> "text-red-600"
    p if p >= 50 -> "text-yellow-600"
    _ -> "text-green-600"
  }

  h.div([a.class("bg-neutral-50 rounded-lg p-4 border border-neutral-200")], [
    h.div(
      [a.class("text-xs text-neutral-600 uppercase tracking-wider mb-1")],
      [element.text(label)],
    ),
    h.div([a.class("flex items-baseline gap-2")], [
      h.div([a.class("text-xl font-bold text-neutral-900")], [
        element.text(value),
      ]),
      h.span([a.class("text-sm font-medium " <> text_color)], [
        element.text(int.to_string(percentage) <> "%"),
      ]),
    ]),
    h.div([a.class("w-full bg-neutral-200 rounded-full h-1.5 mt-2")], [
      h.div(
        [
          a.class("h-1.5 rounded-full " <> bar_color),
          a.attribute("style", "width: " <> int.to_string(percentage) <> "%"),
        ],
        [],
      ),
    ]),
    case sub {
      "" -> element.none()
      _ -> h.div([a.class("text-xs text-neutral-500 mt-1")], [element.text(sub)])
    },
  ])
}

fn float_to_string_1(value: Float) -> String {
  let rounded = float.round(value *. 10.0) |> int.to_float
  let result = rounded /. 10.0
  let str = float.to_string(result)
  case str {
    _ if result == 0.0 -> "0.0"
    _ -> str
  }
}
