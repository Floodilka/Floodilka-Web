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

import floodilka_admin/acl
import floodilka_admin/api/common
import floodilka_admin/api/users
import floodilka_admin/components/helpers
import floodilka_admin/components/icons
import floodilka_admin/components/ui
import floodilka_admin/constants
import floodilka_admin/pages/user_detail/forms
import floodilka_admin/user
import floodilka_admin/web.{type Context}
import gleam/int
import gleam/list
import gleam/option
import gleam/string
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn overview_tab(
  _ctx: Context,
  user: common.UserLookupResult,
  admin_acls: List(String),
  change_log_result: Result(users.ListUserChangeLogResponse, common.ApiError),
) {
  h.div([a.class("space-y-6")], [
    case user.temp_banned_until, user.pending_deletion_at {
      option.Some(until), _ ->
        h.div([a.class("p-4 bg-red-50 border border-red-200 rounded-lg")], [
          h.div(
            [
              a.class(
                "flex items-center gap-2 text-red-900 text-sm font-medium",
              ),
            ],
            [
              element.text("Временный бан до: " <> until),
            ],
          ),
        ])
      _, option.Some(deletion_date) ->
        h.div(
          [a.class("p-4 bg-orange-50 border border-orange-200 rounded-lg")],
          [
            h.div([a.class("text-orange-900 text-sm font-medium")], [
              element.text("Запланировано удаление: " <> deletion_date),
            ]),
            case user.deletion_reason_code, user.deletion_public_reason {
              option.Some(code), option.Some(reason) ->
                h.div([a.class("text-sm text-orange-700 mt-1")], [
                  element.text(
                    "Причина: "
                    <> reason
                    <> " (code: "
                    <> int.to_string(code)
                    <> ")",
                  ),
                ])
              option.Some(code), option.None ->
                h.div([a.class("text-sm text-orange-700 mt-1")], [
                  element.text("Код причины: " <> int.to_string(code)),
                ])
              option.None, option.Some(reason) ->
                h.div([a.class("text-sm text-orange-700 mt-1")], [
                  element.text("Причина: " <> reason),
                ])
              _, _ -> element.none()
            },
          ],
        )
      _, _ -> element.none()
    },
    case user.pending_bulk_message_deletion_at {
      option.Some(deletion_date) ->
        h.div(
          [a.class("p-4 bg-yellow-50 border border-yellow-200 rounded-lg")],
          [
            h.div([a.class("text-yellow-900 text-sm font-medium")], [
              element.text(
                "Массовое удаление запланировано на: " <> deletion_date,
              ),
            ]),
            case
              acl.has_permission(
                admin_acls,
                constants.acl_user_cancel_bulk_message_deletion,
              )
            {
              True ->
                h.form(
                  [
                    a.method("POST"),
                    a.action(
                      "?action=cancel-bulk-message-deletion&tab=overview",
                    ),
                    a.attribute(
                      "onsubmit",
                      "return confirm('Вы уверены, что хотите отменить запланированное массовое удаление сообщений этого пользователя?')",
                    ),
                  ],
                  [
                    h.button(
                      [
                        a.type_("submit"),
                        a.class(
                          "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors mt-3",
                        ),
                      ],
                      [element.text("Отменить массовое удаление")],
                    ),
                  ],
                )
              False -> element.none()
            },
          ],
        )
      option.None -> element.none()
    },
    h.div([a.class("grid grid-cols-1 md:grid-cols-3 gap-6 items-start")], [
      h.div([a.class("md:col-span-2 space-y-6")], [
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Информация об аккаунте"),
          h.div(
            [a.class("grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm")],
            [
              helpers.compact_info_mono("ID пользователя", user.id),
              case user.extract_timestamp(user.id) {
                Ok(created_at) -> helpers.compact_info("Создан", created_at)
                Error(_) -> element.none()
              },
              helpers.compact_info("Имя пользователя", user.username),
              helpers.compact_info_with_element("Email", case user.email {
                option.Some(email) ->
                  h.span([], [
                    h.span([a.class("")], [element.text(email)]),
                    element.text(" "),
                    case user.email_verified {
                      True -> icons.checkmark_icon("text-green-600")
                      False -> icons.x_icon("text-red-600")
                    },
                    case user.email_bounced {
                      True ->
                        h.span([a.class("text-orange-600 ml-1")], [
                          element.text("(отклонён)"),
                        ])
                      False -> element.none()
                    },
                  ])
                option.None ->
                  h.span([a.class("text-neutral-500")], [
                    element.text("Не задано"),
                  ])
              }),
              helpers.compact_info("Телефон", case user.phone {
                option.Some(phone) -> phone
                option.None -> "Не задано"
              }),
              helpers.compact_info("Дата рождения", case user.date_of_birth {
                option.Some(dob) -> dob
                option.None -> "Не задано"
              }),
              helpers.compact_info("Язык", case user.locale {
                option.Some(locale) -> locale
                option.None -> "Не задано"
              }),
              case user.bio {
                option.Some(bio) ->
                  h.div([a.class("md:col-span-2")], [
                    helpers.compact_info("О себе", bio),
                  ])
                option.None -> element.none()
              },
              helpers.compact_info("Бот", case user.bot {
                True -> "Да"
                False -> "Нет"
              }),
              helpers.compact_info("Система", case user.system {
                True -> "Да"
                False -> "Нет"
              }),
              helpers.compact_info("Последняя активность", case user.last_active_at {
                option.Some(at) -> at
                option.None -> "Никогда"
              }),
              helpers.compact_info_with_element(
                "Последний IP",
                case user.last_active_ip {
                  option.Some(ip) ->
                    h.span([], [
                      h.span([a.class("font-mono")], [element.text(ip)]),
                      case user.last_active_ip_reverse {
                        option.Some(reverse) ->
                          h.span([a.class("text-neutral-500 ml-2")], [
                            element.text("(" <> reverse <> ")"),
                          ])
                        option.None -> element.none()
                      },
                    ])
                  option.None ->
                    h.span([a.class("text-neutral-500")], [
                      element.text("Не записано"),
                    ])
                },
              ),
              helpers.compact_info("Местоположение", case user.last_active_location {
                option.Some(location) -> location
                option.None -> "Неизвестно"
              }),
            ],
          ),
        ]),
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Безопасность и Premium"),
          h.div(
            [a.class("grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm")],
            [
              helpers.compact_info(
                "Аутентификаторы",
                case list.is_empty(user.authenticator_types) {
                  True -> "Нет"
                  False -> {
                    let types =
                      list.map(user.authenticator_types, fn(t) {
                        case t {
                          0 -> "TOTP"
                          1 -> "SMS"
                          2 -> "WebAuthn"
                          _ -> "Неизвестно"
                        }
                      })
                    string.join(types, ", ")
                  }
                },
              ),
              helpers.compact_info("Тип Premium", case user.premium_type {
                option.Some(0) | option.None -> "Нет"
                option.Some(1) -> "Подписка"
                option.Some(2) -> "Пожизненный"
                option.Some(_) -> "Неизвестно"
              }),
              case user.premium_since {
                option.Some(since) ->
                  helpers.compact_info("Premium с", since)
                option.None -> element.none()
              },
              case user.premium_until {
                option.Some(until) ->
                  helpers.compact_info("Premium до", until)
                option.None -> element.none()
              },
            ],
          ),
        ]),
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Флаги пользователя"),
          forms.render_flags_form(user.flags),
        ]),
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Флаги подозрительной активности"),
          forms.render_suspicious_flags_form(user.suspicious_activity_flags),
        ]),
        render_change_log(change_log_result),
      ]),
      ui.card(ui.PaddingMedium, [
        ui.heading_card_with_margin("ACL администратора"),
        forms.render_acls_form(user, admin_acls),
      ]),
    ]),
  ])
}

fn render_change_log(
  change_log_result: Result(users.ListUserChangeLogResponse, common.ApiError),
) {
  ui.card(ui.PaddingMedium, [
    ui.heading_card_with_margin("История изменений контактов"),
    case change_log_result {
      Ok(resp) -> render_change_log_entries(resp.entries)
      Error(err) ->
        h.div([a.class("text-sm text-red-700")], [
          element.text("Не удалось загрузить историю изменений: " <> format_error(err)),
        ])
    },
  ])
}

fn render_change_log_entries(entries: List(users.ContactChangeLogEntry)) {
  case entries {
    [] ->
      h.div([a.class("text-sm text-neutral-600")], [
        element.text("Нет записей об изменении контактов."),
      ])
    _ ->
      h.ul(
        [a.class("divide-y divide-neutral-200")],
        list.map(entries, render_entry),
      )
  }
}

fn render_entry(entry: users.ContactChangeLogEntry) {
  h.li([a.class("py-3 flex flex-col gap-1")], [
    h.div([a.class("flex items-center gap-2 text-sm")], [
      h.span([a.class("font-medium text-neutral-900")], [
        element.text(label_for_field(entry.field)),
      ]),
      h.span([a.class("text-neutral-500")], [element.text(entry.event_at)]),
    ]),
    h.div([a.class("text-sm text-neutral-800")], [
      element.text(old_new_text(entry.old_value, entry.new_value)),
    ]),
    h.div([a.class("text-xs text-neutral-600")], [
      element.text("Причина: " <> entry.reason),
      case entry.actor_user_id {
        option.Some(actor) -> element.text(" • Инициатор: " <> actor)
        option.None -> element.none()
      },
    ]),
  ])
}

fn label_for_field(field: String) {
  case field {
    "email" -> "Email"
    "phone" -> "Телефон"
    "username" -> "Имя пользователя"
    _ -> field
  }
}

fn old_new_text(
  old_value: option.Option(String),
  new_value: option.Option(String),
) {
  let old_display = case old_value {
    option.Some(v) -> v
    option.None -> "null"
  }
  let new_display = case new_value {
    option.Some(v) -> v
    option.None -> "null"
  }
  old_display <> " → " <> new_display
}

fn format_error(err: common.ApiError) {
  case err {
    common.Unauthorized -> "Не авторизован"
    common.Forbidden(message) -> message
    common.NotFound -> "Не найдено"
    common.ServerError -> "Ошибка сервера"
    common.NetworkError -> "Ошибка сети"
  }
}
