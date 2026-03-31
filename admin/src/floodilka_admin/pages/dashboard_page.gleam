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
import floodilka_admin/api/system
import floodilka_admin/avatar
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session, href}
import gleam/float
import gleam/int
import gleam/list
import gleam/option
import gleam/string
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
  let result = system.get_system_stats(ctx, session)

  let content = case result {
    Ok(stats) -> render_dashboard(ctx, stats)
    Error(common.Unauthorized) -> render_error("Не авторизован")
    Error(common.Forbidden(message)) -> render_error(message)
    Error(common.NotFound) -> render_error("Не найдено")
    Error(common.ServerError) -> render_error("Ошибка сервера")
    Error(common.NetworkError) -> render_error("Ошибка сети")
  }

  let html =
    layout.page_with_refresh(
      "Панель управления",
      "dashboard",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
      True,
    )
  wisp.html_response(element.to_document_string(html), 200)
}

fn render_error(message: String) {
  ui.stack("6", [
    ui.heading_page("Панель управления"),
    h.div(
      [a.class("bg-red-50 border border-red-200 rounded-lg p-6 text-center")],
      [h.p([a.class("text-red-800")], [element.text(message)])],
    ),
  ])
}

fn render_dashboard(ctx: Context, stats: system.SystemStats) {
  h.div([], [
    ui.flex_row_between([
      ui.heading_page("Панель управления"),
      h.div([a.class("text-xs text-neutral-400")], [
        element.text("Автообновление каждые 3 сек"),
      ]),
    ]),
    h.div([a.class("space-y-6")], [
      render_stats_grid(stats),
      render_system_info(stats),
      render_online_users(ctx, stats.users),
    ]),
  ])
}

fn render_stats_grid(stats: system.SystemStats) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm p-6")],
    [
      ui.heading_section("Обзор системы"),
      h.div(
        [
          a.class(
            "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4",
          ),
        ],
        [
          stat_card_with_progress(
            "Загрузка CPU",
            float_to_string_1(stats.cpu.usage) <> "%",
            int.to_string(stats.cpu.count) <> " ядер",
            float.round(stats.cpu.usage),
          ),
          stat_card_with_progress(
            "Память",
            format_bytes(stats.memory.used),
            format_bytes(stats.memory.total) <> " всего",
            stats.memory.usage_percentage,
          ),
          case stats.disk {
            option.Some(disk) ->
              stat_card_with_progress(
                "Диск",
                format_bytes(disk.used),
                format_bytes(disk.total) <> " всего",
                disk.usage_percentage,
              )
            option.None -> element.none()
          },
          stat_card("Время работы", format_uptime(stats.uptime), option.None),
          stat_card(
            "Подключения",
            format_number(stats.connections),
            option.None,
          ),
          stat_card("Статусы", format_number(stats.presences), option.None),
          stat_card("Серверы", format_number(stats.guilds), option.None),
          stat_card("Звонки", format_number(stats.calls), option.None),
          stat_card(
            "Пользователи",
            int.to_string(stats.users.online)
              <> " / "
              <> format_number(stats.users.total),
            option.Some("онлайн / всего"),
          ),
        ],
      ),
    ],
  )
}

fn render_system_info(stats: system.SystemStats) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm p-6")],
    [
      ui.heading_section("Информация о системе"),
      h.div(
        [a.class("grid grid-cols-2 md:grid-cols-4 gap-4 mt-4")],
        [
          info_item("Платформа", stats.os_info.platform),
          info_item("Архитектура", stats.os_info.arch),
          info_item("Тип ОС", stats.os_info.os_type),
          info_item("Node.js", stats.node_version),
          info_item("Модель CPU", stats.cpu.model),
          info_item(
            "Средняя нагрузка",
            stats.cpu.load_avg
              |> list.map(float_to_string_1)
              |> string.join(", "),
          ),
          info_item("Ядро", stats.os_info.release),
          info_item("Время", stats.timestamp),
        ],
      ),
    ],
  )
}

fn render_online_users(ctx: Context, users: system.UsersInfo) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm")],
    [
      h.div([a.class("p-6 border-b border-neutral-200")], [
        ui.heading_section(
          "Пользователи онлайн (" <> int.to_string(users.online) <> ")",
        ),
      ]),
      case list.is_empty(users.list) {
        True ->
          h.div([a.class("p-6 text-center text-neutral-500")], [
            element.text("Нет пользователей онлайн"),
          ])
        False ->
          h.div([a.class("divide-y divide-neutral-100")],
            list.map(users.list, fn(user) {
              render_online_user(ctx, user)
            }),
          )
      },
    ],
  )
}

fn render_online_user(ctx: Context, user: system.OnlineUser) {
  h.a(
    [
      href(ctx, "/users/" <> user.id),
      a.class(
        "flex items-center gap-3 px-6 py-3 hover:bg-neutral-50 transition-colors",
      ),
    ],
    [
      h.img([
        a.src(avatar.get_user_avatar_url(
          ctx.media_endpoint,
          ctx.cdn_endpoint,
          user.id,
          user.avatar,
          False,
          ctx.asset_version,
        )),
        a.alt(user.username),
        a.class("w-8 h-8 rounded-full"),
      ]),
      h.div([], [
        h.div([a.class("text-sm font-medium text-neutral-900")], [
          element.text(case user.display_name {
            option.Some(dn) -> dn
            option.None -> user.username
          }),
        ]),
        h.div([a.class("text-xs text-neutral-500")], [
          element.text(user.username),
        ]),
      ]),
      h.div([a.class("ml-auto")], [
        h.span([a.class("text-xs text-neutral-400 font-mono")], [
          element.text(user.id),
        ]),
      ]),
    ],
  )
}

fn stat_card(
  label: String,
  value: String,
  sub: option.Option(String),
) {
  h.div([a.class("bg-neutral-50 rounded-lg p-4 border border-neutral-200")], [
    h.div(
      [a.class("text-xs text-neutral-600 uppercase tracking-wider mb-1")],
      [element.text(label)],
    ),
    h.div([a.class("text-xl font-bold text-neutral-900")], [
      element.text(value),
    ]),
    case sub {
      option.Some(s) ->
        h.div([a.class("text-xs text-neutral-500 mt-1")], [element.text(s)])
      option.None -> element.none()
    },
  ])
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
    h.div([a.class("text-xs text-neutral-500 mt-1")], [element.text(sub)]),
  ])
}

fn info_item(label: String, value: String) {
  h.div([], [
    h.div([a.class("text-xs text-neutral-500 mb-0.5")], [element.text(label)]),
    h.div([a.class("text-sm font-medium text-neutral-900 truncate")], [
      element.text(value),
    ]),
  ])
}

fn format_bytes(bytes: Int) -> String {
  let fb = int.to_float(bytes)
  case bytes {
    b if b < 1024 -> int.to_string(b) <> " B"
    b if b < 1_048_576 -> float_to_string_1(fb /. 1024.0) <> " KB"
    b if b < 1_073_741_824 -> float_to_string_1(fb /. 1_048_576.0) <> " MB"
    _ -> float_to_string_1(fb /. 1_073_741_824.0) <> " GB"
  }
}

fn format_uptime(seconds: Int) -> String {
  let days = seconds / 86_400
  let hours = { seconds % 86_400 } / 3600
  let mins = { seconds % 3600 } / 60

  case days {
    0 -> int.to_string(hours) <> "h " <> int.to_string(mins) <> "m"
    _ ->
      int.to_string(days)
      <> "d "
      <> int.to_string(hours)
      <> "h "
      <> int.to_string(mins)
      <> "m"
  }
}

fn format_number(n: Int) -> String {
  let s = int.to_string(n)
  let len = string.length(s)

  case len {
    _ if len <= 3 -> s
    _ -> {
      let groups = reverse_groups(s, [])
      string.join(groups, ",")
    }
  }
}

fn reverse_groups(s: String, acc: List(String)) -> List(String) {
  let len = string.length(s)
  case len {
    0 -> acc
    _ if len <= 3 -> [s, ..acc]
    _ -> {
      let group = string.slice(s, len - 3, 3)
      let rest = string.slice(s, 0, len - 3)
      reverse_groups(rest, [group, ..acc])
    }
  }
}

fn float_to_string_1(value: Float) -> String {
  let rounded = float.round(value *. 10.0) |> int.to_float
  let result = rounded /. 10.0
  let str = float.to_string(result)
  case string.contains(str, ".") {
    True -> str
    False -> str <> ".0"
  }
}
