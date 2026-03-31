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
import floodilka_admin/api/search
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session, href}
import gleam/int
import gleam/option
import gleam/string
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Request, type Response}

pub fn view(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  flash_data: option.Option(flash.Flash),
  job_id: option.Option(String),
) -> Response {
  let should_auto_refresh = case job_id {
    option.Some(id) -> {
      case search.get_index_refresh_status(ctx, session, id) {
        Ok(status) ->
          status.status == "in_progress" || status.status == "not_found"
        Error(common.NotFound) -> True
        Error(_) -> False
      }
    }
    option.None -> False
  }

  let content =
    h.div([a.class("max-w-3xl mx-auto space-y-6")], [
      ui.heading_page("Управление поисковым индексом"),
      render_reindex_controls(ctx),
      case job_id {
        option.Some(id) -> render_status_section(ctx, session, id)
        option.None -> element.none()
      },
    ])

  let html =
    layout.page_with_refresh(
      "Управление поиском",
      "search-index",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
      should_auto_refresh,
    )
  wisp.html_response(element.to_document_string(html), 200)
}

pub fn handle_reindex(
  _req: Request,
  ctx: Context,
  session: Session,
  index_type: option.Option(String),
) -> Response {
  case index_type {
    option.Some(idx_type) -> {
      case search.refresh_search_index(ctx, session, idx_type, option.None) {
        Ok(response) ->
          wisp.redirect(web.prepend_base_path(
            ctx,
            "/search-index?job_id=" <> response.job_id,
          ))
        Error(_) ->
          wisp.redirect(web.prepend_base_path(ctx, "/search-index?error=failed"))
      }
    }
    option.None -> wisp.redirect(web.prepend_base_path(ctx, "/search-index"))
  }
}

fn render_reindex_controls(ctx: Context) {
  h.div([a.class("space-y-3")], [
    h.h3([a.class("subtitle text-neutral-900")], [
      element.text("Глобальные поисковые индексы"),
    ]),
    render_reindex_button(ctx, "Пользователи", "users"),
    render_reindex_button(ctx, "Серверы", "guilds"),
    render_reindex_button(ctx, "Жалобы", "reports"),
    render_reindex_button(ctx, "Журнал аудита", "audit_logs"),
    h.h3([a.class("subtitle text-neutral-900 mt-6")], [
      element.text("Поисковые индексы серверов"),
    ]),
    h.p([a.class("body-sm text-neutral-600 mb-3")], [
      element.text(
        "Эти индексы требуют ID сервера и могут быть запущены только со страницы сервера.",
      ),
    ]),
    render_disabled_reindex_button(ctx, "Сообщения каналов", "channel_messages"),
  ])
}

fn render_reindex_button(ctx: Context, title: String, index_type: String) {
  h.form(
    [
      a.class("flex"),
      a.method("post"),
      web.action(ctx, "/search-index?action=reindex"),
    ],
    [
      h.input([a.type_("hidden"), a.name("index_type"), a.value(index_type)]),
      h.button(
        [
          a.type_("submit"),
          a.class(
            "w-full px-4 py-3 rounded-lg border border-neutral-300 bg-white text-neutral-900 label hover:bg-neutral-100 transition-colors",
          ),
        ],
        [element.text("Переиндексировать: " <> title)],
      ),
    ],
  )
}

fn render_disabled_reindex_button(
  _ctx: Context,
  title: String,
  _index_type: String,
) {
  h.div([a.class("flex")], [
    h.button(
      [
        a.disabled(True),
        a.class(
          "w-full px-4 py-3 rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-400 label cursor-not-allowed",
        ),
      ],
      [element.text("Переиндексировать: " <> title)],
    ),
  ])
}

fn render_status_section(ctx: Context, session: Session, job_id: String) {
  let status_result = search.get_index_refresh_status(ctx, session, job_id)

  h.div([a.class("border border-neutral-200 rounded-lg p-4 space-y-3 mt-6")], [
    h.div([a.class("flex items-center justify-between")], [
      h.h2([a.class("subtitle text-neutral-900")], [
        element.text("Прогресс переиндексации"),
      ]),
      h.a([href(ctx, "/search-index"), a.class("body-sm text-neutral-600")], [
        element.text("Очистить"),
      ]),
    ]),
    case status_result {
      Ok(status) -> {
        case status.status {
          "not_found" ->
            h.p([a.class("body-sm text-neutral-700")], [
              element.text("Подготовка задачи… проверьте через момент."),
            ])
          _ -> render_status_content(ctx, status)
        }
      }
      Error(common.NotFound) ->
        h.p([a.class("body-sm text-neutral-700")], [
          element.text("Подготовка задачи… проверьте через момент."),
        ])
      Error(err) -> render_status_error(ctx, err)
    },
  ])
}

fn render_status_content(_ctx: Context, status: search.IndexRefreshStatus) {
  h.div([a.class("space-y-3")], [
    h.p([a.class("body-sm text-neutral-700")], [
      element.text("Статус: " <> format_status_label(status.status)),
    ]),
    case status.status, status.total, status.indexed {
      "in_progress", option.Some(total), option.Some(indexed) -> {
        let percentage = case total {
          0 -> 0
          _ -> { indexed * 100 } / total
        }
        h.div([a.class("space-y-2")], [
          h.div([a.class("flex justify-between body-sm text-neutral-700")], [
            h.span([], [
              element.text(
                int.to_string(indexed)
                <> " / "
                <> int.to_string(total)
                <> " ("
                <> int.to_string(percentage)
                <> "%)",
              ),
            ]),
          ]),
          h.div(
            [a.class("w-full bg-neutral-200 rounded-full h-2 overflow-hidden")],
            [
              h.div(
                [
                  a.class("bg-neutral-900 h-2 transition-[width] duration-300"),
                  a.attribute(
                    "style",
                    "width: " <> int.to_string(percentage) <> "%",
                  ),
                ],
                [],
              ),
            ],
          ),
        ])
      }
      "completed", option.Some(total), option.Some(indexed) ->
        h.p([a.class("body-sm text-neutral-700")], [
          element.text(
            "Проиндексировано "
            <> int.to_string(indexed)
            <> " / "
            <> int.to_string(total)
            <> " элементов",
          ),
        ])
      _, _, _ -> element.none()
    },
    case status.started_at {
      option.Some(timestamp) ->
        h.p([a.class("caption text-neutral-500")], [
          element.text("Начало: " <> format_timestamp(timestamp)),
        ])
      option.None -> element.none()
    },
    case status.completed_at {
      option.Some(timestamp) ->
        h.p([a.class("caption text-neutral-500")], [
          element.text("Завершено: " <> format_timestamp(timestamp)),
        ])
      option.None -> element.none()
    },
    case status.error {
      option.Some(error_msg) ->
        h.p([a.class("body-sm text-red-600")], [element.text(error_msg)])
      option.None -> element.none()
    },
  ])
}

fn render_status_error(_ctx: Context, err: common.ApiError) {
  let #(title, message) = case err {
    common.Unauthorized -> #(
      "Требуется авторизация",
      "Ваша сессия истекла. Пожалуйста, войдите снова.",
    )
    common.Forbidden(msg) -> #("Доступ запрещён", msg)
    common.NotFound -> #("Не найдено", "Информация о статусе не найдена.")
    common.ServerError -> #(
      "Ошибка сервера",
      "Произошла внутренняя ошибка сервера. Попробуйте позже.",
    )
    common.NetworkError -> #(
      "Ошибка сети",
      "Не удалось подключиться к API. Попробуйте позже.",
    )
  }

  h.div([a.class("space-y-1 body-sm text-red-600")], [
    h.p([], [element.text(title)]),
    h.p([], [element.text(message)]),
  ])
}

fn format_status_label(status: String) -> String {
  case status {
    "in_progress" -> "В процессе"
    "completed" -> "Завершено"
    "failed" -> "Ошибка"
    _ -> "Неизвестно"
  }
}

fn format_timestamp(timestamp: String) -> String {
  case string.split(timestamp, "T") {
    [date_part, time_part] -> {
      let time_clean = case string.split(time_part, ".") {
        [hms, _] -> hms
        _ -> time_part
      }
      let time_clean = string.replace(time_clean, "Z", "")

      case string.split(time_clean, ":") {
        [hour, minute, _] -> date_part <> " " <> hour <> ":" <> minute
        _ -> timestamp
      }
    }
    _ -> timestamp
  }
}
