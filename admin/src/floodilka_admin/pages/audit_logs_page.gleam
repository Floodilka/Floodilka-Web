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

import floodilka_admin/api/audit
import floodilka_admin/api/common
import floodilka_admin/components/date_time
import floodilka_admin/components/errors
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session, href}
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
  query: option.Option(String),
  admin_user_id_filter: option.Option(String),
  target_type: option.Option(String),
  target_id: option.Option(String),
  action: option.Option(String),
  current_page: Int,
) -> Response {
  let limit = 50
  let offset = { current_page - 1 } * limit

  let result =
    audit.search_audit_logs(
      ctx,
      session,
      query,
      admin_user_id_filter,
      target_type,
      target_id,
      action,
      limit,
      offset,
    )

  let content = case result {
    Ok(response) -> {
      let total_pages = { response.total + limit - 1 } / limit

      h.div([a.class("max-w-7xl mx-auto")], [
        ui.flex_row_between([
          ui.heading_page("Журнал аудита"),
          h.div([a.class("flex items-center gap-4")], [
            h.span([a.class("text-sm text-neutral-600")], [
              element.text(
                "Показано "
                <> int.to_string(list.length(response.logs))
                <> " из "
                <> int.to_string(response.total)
                <> " записей",
              ),
            ]),
          ]),
        ]),
        render_filters(
          ctx,
          query,
          admin_user_id_filter,
          target_type,
          target_id,
          action,
        ),
        case list.is_empty(response.logs) {
          True -> empty_state()
          False -> render_logs_table(ctx, response.logs)
        },
        case response.total > limit {
          True ->
            render_pagination(
              ctx,
              current_page,
              total_pages,
              query,
              admin_user_id_filter,
              target_type,
              target_id,
              action,
            )
          False -> element.none()
        },
      ])
    }
    Error(err) -> errors.api_error_view(ctx, err, option.None, option.None)
  }

  let html =
    layout.page(
      "Журнал аудита",
      "audit-logs",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
    )
  wisp.html_response(element.to_document_string(html), 200)
}

fn render_filters(
  ctx: Context,
  query: option.Option(String),
  admin_user_id_filter: option.Option(String),
  target_type: option.Option(String),
  target_id: option.Option(String),
  action: option.Option(String),
) {
  h.div([a.class("bg-white border border-neutral-200 rounded-lg p-4 mb-6")], [
    h.form([a.method("get"), a.class("space-y-4")], [
      h.div([a.class("w-full")], [
        h.label([a.class("block text-sm text-neutral-700 mb-2")], [
          element.text("Поиск"),
        ]),
        h.input([
          a.type_("text"),
          a.name("q"),
          a.value(option.unwrap(query, "")),
          a.placeholder("Поиск по действию, причине или метаданным..."),
          a.class(
            "w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent",
          ),
        ]),
      ]),
      h.div([a.class("grid grid-cols-1 md:grid-cols-4 gap-4")], [
        h.div([a.class("flex-1")], [
          h.label([a.class("block text-sm text-neutral-700 mb-2")], [
            element.text("Действие"),
          ]),
          h.select(
            [
              a.name("action"),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent",
              ),
            ],
            [
              h.option([a.value(""), a.selected(option.is_none(action))], "Все"),
              h.option(
                [
                  a.value("temp_ban"),
                  a.selected(action == option.Some("temp_ban")),
                ],
                "Временный бан",
              ),
              h.option(
                [a.value("unban"), a.selected(action == option.Some("unban"))],
                "Разбан",
              ),
              h.option(
                [
                  a.value("schedule_deletion"),
                  a.selected(action == option.Some("schedule_deletion")),
                ],
                "Запланировать удаление",
              ),
              h.option(
                [
                  a.value("cancel_deletion"),
                  a.selected(action == option.Some("cancel_deletion")),
                ],
                "Отменить удаление",
              ),
              h.option(
                [
                  a.value("update_flags"),
                  a.selected(action == option.Some("update_flags")),
                ],
                "Обновить флаги",
              ),
              h.option(
                [
                  a.value("update_features"),
                  a.selected(action == option.Some("update_features")),
                ],
                "Обновить функции",
              ),
              h.option(
                [
                  a.value("delete_message"),
                  a.selected(action == option.Some("delete_message")),
                ],
                "Удалить сообщение",
              ),
              h.option(
                [a.value("ban_ip"), a.selected(action == option.Some("ban_ip"))],
                "Бан IP",
              ),
              h.option(
                [
                  a.value("ban_email"),
                  a.selected(action == option.Some("ban_email")),
                ],
                "Бан Email",
              ),
              h.option(
                [
                  a.value("ban_phone"),
                  a.selected(action == option.Some("ban_phone")),
                ],
                "Бан телефона",
              ),
            ],
          ),
        ]),
        h.div([a.class("flex-1")], [
          h.label([a.class("block text-sm text-neutral-700 mb-2")], [
            element.text("Тип объекта"),
          ]),
          h.select(
            [
              a.name("target_type"),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent",
              ),
            ],
            [
              h.option([a.value("")], "Все типы"),
              h.option(
                [
                  a.value("user"),
                  a.selected(target_type == option.Some("user")),
                ],
                "Пользователь",
              ),
              h.option(
                [
                  a.value("guild"),
                  a.selected(target_type == option.Some("guild")),
                ],
                "Сервер",
              ),
              h.option(
                [
                  a.value("message"),
                  a.selected(target_type == option.Some("message")),
                ],
                "Сообщение",
              ),
              h.option(
                [a.value("ip"), a.selected(target_type == option.Some("ip"))],
                "IP",
              ),
              h.option(
                [
                  a.value("email"),
                  a.selected(target_type == option.Some("email")),
                ],
                "Email",
              ),
              h.option(
                [
                  a.value("phone"),
                  a.selected(target_type == option.Some("phone")),
                ],
                "Телефон",
              ),
            ],
          ),
        ]),
        h.div([a.class("flex-1")], [
          h.label([a.class("block text-sm text-neutral-700 mb-2")], [
            element.text("ID объекта"),
          ]),
          h.input([
            a.type_("text"),
            a.name("target_id"),
            a.value(option.unwrap(target_id, "")),
            a.placeholder("Фильтр по ID объекта..."),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent",
            ),
          ]),
        ]),
        h.div([a.class("flex-1")], [
          h.label([a.class("block text-sm text-neutral-700 mb-2")], [
            element.text("ID администратора (необязательно)"),
          ]),
          h.input([
            a.type_("text"),
            a.name("admin_user_id"),
            a.value(option.unwrap(admin_user_id_filter, "")),
            a.placeholder("ID конкретного администратора..."),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent",
            ),
          ]),
        ]),
      ]),
      h.div([a.class("flex gap-2")], [
        h.button(
          [
            a.type_("submit"),
            a.class(
              "px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors",
            ),
          ],
          [element.text("Поиск и фильтр")],
        ),
        h.a(
          [
            href(ctx, "/audit-logs"),
            a.class(
              "px-4 py-2 bg-white text-neutral-700 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors",
            ),
          ],
          [element.text("Сбросить")],
        ),
      ]),
    ]),
  ])
}

fn render_logs_table(ctx: Context, logs: List(audit.AuditLog)) {
  ui.table_container([
    h.table([a.class("min-w-full divide-y divide-neutral-200")], [
      h.thead([a.class("bg-neutral-50")], [
        h.tr([], [
          ui.table_header_cell("Время"),
          ui.table_header_cell("Действие"),
          ui.table_header_cell("Администратор"),
          ui.table_header_cell("Объект"),
          ui.table_header_cell("Причина"),
          ui.table_header_cell("Детали"),
        ]),
      ]),
      h.tbody(
        [a.class("bg-white divide-y divide-neutral-200")],
        list.map(logs, fn(log) { render_log_row(ctx, log) }),
      ),
    ]),
  ])
}

fn render_log_row(ctx: Context, log: audit.AuditLog) {
  let expanded_id = "expanded-" <> log.log_id

  case list.is_empty(log.metadata) {
    True ->
      h.tr([a.class("hover:bg-neutral-50 transition-colors")], [
        h.td([a.class(ui.table_cell_class <> " whitespace-nowrap")], [
          element.text(date_time.format_timestamp(log.created_at)),
        ]),
        h.td([a.class("px-6 py-4 whitespace-nowrap")], [
          action_pill(log.action),
        ]),
        render_admin_cell(ctx, log.admin_user_id),
        render_target_cell(ctx, log.target_type, log.target_id),
        h.td([a.class(ui.table_cell_muted_class)], [
          case log.audit_log_reason {
            option.Some(reason) -> element.text(reason)
            option.None ->
              h.span([a.class("text-neutral-400 italic")], [element.text("—")])
          },
        ]),
        h.td([a.class(ui.table_cell_muted_class)], [
          h.span([a.class("text-neutral-400 italic")], [element.text("—")]),
        ]),
      ])
    False ->
      element.fragment([
        h.tr([a.class("hover:bg-neutral-50 transition-colors")], [
          h.td([a.class(ui.table_cell_class <> " whitespace-nowrap")], [
            element.text(date_time.format_timestamp(log.created_at)),
          ]),
          h.td([a.class("px-6 py-4 whitespace-nowrap")], [
            action_pill(log.action),
          ]),
          render_admin_cell(ctx, log.admin_user_id),
          render_target_cell(ctx, log.target_type, log.target_id),
          h.td([a.class(ui.table_cell_muted_class)], [
            case log.audit_log_reason {
              option.Some(reason) -> element.text(reason)
              option.None ->
                h.span([a.class("text-neutral-400 italic")], [element.text("—")])
            },
          ]),
          h.td([a.class(ui.table_cell_muted_class)], [
            h.button(
              [
                a.class(
                  "cursor-pointer text-neutral-900 hover:text-neutral-600 underline decoration-neutral-300 hover:decoration-neutral-500",
                ),
                a.attribute(
                  "onclick",
                  "document.getElementById('"
                    <> expanded_id
                    <> "').classList.toggle('hidden')",
                ),
              ],
              [element.text("Показать детали")],
            ),
          ]),
        ]),
        h.tr([a.id(expanded_id), a.class("hidden bg-neutral-50")], [
          h.td([a.attribute("colspan", "6"), a.class("px-6 py-4")], [
            render_metadata_expanded(log.metadata),
          ]),
        ]),
      ])
  }
}

fn render_admin_cell(ctx: Context, admin_user_id: String) {
  h.td([a.class(ui.table_cell_class <> " whitespace-nowrap")], [
    case string.is_empty(admin_user_id) {
      True -> h.span([a.class("text-neutral-400 italic")], [element.text("—")])
      False ->
        h.a(
          [
            href(ctx, "/users/" <> admin_user_id),
            a.class(
              "text-neutral-900 hover:text-neutral-600 underline decoration-neutral-300 hover:decoration-neutral-500",
            ),
          ],
          [element.text("Пользователь " <> admin_user_id)],
        )
    },
  ])
}

fn render_target_cell(ctx: Context, target_type: String, target_id: String) {
  h.td([a.class(ui.table_cell_class <> " whitespace-nowrap")], [
    case target_type, target_id {
      "user", id -> {
        h.a(
          [
            href(ctx, "/users/" <> id),
            a.class(
              "text-neutral-900 hover:text-neutral-600 underline decoration-neutral-300 hover:decoration-neutral-500",
            ),
          ],
          [element.text("Пользователь " <> id)],
        )
      }
      "guild", id -> {
        h.a(
          [
            href(ctx, "/guilds/" <> id),
            a.class(
              "text-neutral-900 hover:text-neutral-600 underline decoration-neutral-300 hover:decoration-neutral-500",
            ),
          ],
          [element.text("Сервер " <> id)],
        )
      }
      type_, id ->
        h.span([a.class("text-neutral-900")], [
          element.text(string.capitalise(type_) <> " " <> id),
        ])
    },
  ])
}

fn render_metadata_expanded(metadata: List(#(String, String))) {
  h.div(
    [a.class("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3")],
    list.map(metadata, fn(entry) {
      let #(key, value) = entry
      h.div([a.class("bg-white border border-neutral-200 rounded-lg p-3")], [
        h.div([a.class("text-xs text-neutral-500 uppercase mb-1")], [
          element.text(key),
        ]),
        h.div([a.class("text-sm text-neutral-900 break-all")], [
          element.text(value),
        ]),
      ])
    }),
  )
}

fn format_action(action: String) -> String {
  action
  |> string.replace("_", " ")
  |> string.capitalise
}

fn action_pill(action: String) {
  ui.pill(format_action(action), action_tone(action))
}

fn action_tone(action: String) -> ui.PillTone {
  case action {
    "temp_ban"
    | "disable_suspicious_activity"
    | "schedule_deletion"
    | "ban_ip"
    | "ban_email"
    | "ban_phone" -> ui.PillDanger
    "unban" | "cancel_deletion" | "unban_ip" | "unban_email" | "unban_phone" ->
      ui.PillSuccess
    "update_flags" | "update_features" | "set_acls" | "update_settings" ->
      ui.PillInfo
    "delete_message" -> ui.PillOrange
    _ -> ui.PillNeutral
  }
}

fn empty_state() {
  ui.card_empty([
    ui.text_muted("Записи аудита не найдены"),
    ui.text_small_muted("Попробуйте изменить фильтры или проверьте позже"),
  ])
}

fn render_pagination(
  ctx: Context,
  current_page: Int,
  total_pages: Int,
  query: option.Option(String),
  admin_user_id_filter: option.Option(String),
  target_type: option.Option(String),
  target_id: option.Option(String),
  action: option.Option(String),
) {
  let build_url = fn(page: Int) {
    let base = "/audit-logs?page=" <> int.to_string(page)
    let with_query = case query {
      option.Some(q) if q != "" -> base <> "&q=" <> q
      _ -> base
    }
    let with_admin_user = case admin_user_id_filter {
      option.Some(id) if id != "" -> with_query <> "&admin_user_id=" <> id
      _ -> with_query
    }
    let with_target_type = case target_type {
      option.Some(tt) if tt != "" -> with_admin_user <> "&target_type=" <> tt
      _ -> with_admin_user
    }
    let with_target_id = case target_id {
      option.Some(tid) if tid != "" -> with_target_type <> "&target_id=" <> tid
      _ -> with_target_type
    }
    let with_action = case action {
      option.Some(act) if act != "" -> with_target_id <> "&action=" <> act
      _ -> with_target_id
    }
    with_action
  }

  h.div(
    [
      a.class(
        "mt-6 flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3 sm:px-6 rounded-b-lg",
      ),
    ],
    [
      h.div([a.class("flex flex-1 justify-between sm:hidden")], [
        case current_page > 1 {
          True ->
            h.a(
              [
                href(ctx, build_url(current_page - 1)),
                a.class(
                  "relative inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50",
                ),
              ],
              [element.text("Назад")],
            )
          False ->
            h.span(
              [
                a.class(
                  "relative inline-flex items-center rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-400 cursor-not-allowed",
                ),
              ],
              [element.text("Назад")],
            )
        },
        case current_page < total_pages {
          True ->
            h.a(
              [
                href(ctx, build_url(current_page + 1)),
                a.class(
                  "relative ml-3 inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50",
                ),
              ],
              [element.text("Вперёд")],
            )
          False ->
            h.span(
              [
                a.class(
                  "relative ml-3 inline-flex items-center rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-400 cursor-not-allowed",
                ),
              ],
              [element.text("Вперёд")],
            )
        },
      ]),
      h.div(
        [a.class("hidden sm:flex sm:flex-1 sm:items-center sm:justify-between")],
        [
          h.div([], [
            h.p([a.class("text-sm text-neutral-700")], [
              element.text(
                "Страница "
                <> int.to_string(current_page)
                <> " из "
                <> int.to_string(total_pages),
              ),
            ]),
          ]),
          h.div([], [
            h.nav(
              [a.class("isolate inline-flex -space-x-px rounded-md shadow-sm")],
              [
                case current_page > 1 {
                  True ->
                    h.a(
                      [
                        href(ctx, build_url(current_page - 1)),
                        a.class(
                          "relative inline-flex items-center rounded-l-md px-4 py-2 text-neutral-900 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 focus:z-20 focus:outline-offset-0",
                        ),
                      ],
                      [element.text("Назад")],
                    )
                  False ->
                    h.span(
                      [
                        a.class(
                          "relative inline-flex items-center rounded-l-md px-4 py-2 text-neutral-400 ring-1 ring-inset ring-neutral-300 bg-neutral-100 cursor-not-allowed",
                        ),
                      ],
                      [element.text("Назад")],
                    )
                },
                case current_page < total_pages {
                  True ->
                    h.a(
                      [
                        href(ctx, build_url(current_page + 1)),
                        a.class(
                          "relative inline-flex items-center rounded-r-md px-4 py-2 text-neutral-900 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 focus:z-20 focus:outline-offset-0",
                        ),
                      ],
                      [element.text("Вперёд")],
                    )
                  False ->
                    h.span(
                      [
                        a.class(
                          "relative inline-flex items-center rounded-r-md px-4 py-2 text-neutral-400 ring-1 ring-inset ring-neutral-300 bg-neutral-100 cursor-not-allowed",
                        ),
                      ],
                      [element.text("Вперёд")],
                    )
                },
              ],
            ),
          ]),
        ],
      ),
    ],
  )
}
