//// Copyright (C) 2026 Fluxer Contributors
////
//// This file is part of Fluxer.
////
//// Fluxer is free software: you can redistribute it and/or modify
//// it under the terms of the GNU Affero General Public License as published by
//// the Free Software Foundation, either version 3 of the License, or
//// (at your option) any later version.
////
//// Fluxer is distributed in the hope that it will be useful,
//// but WITHOUT ANY WARRANTY; without even the implied warranty of
//// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
//// GNU Affero General Public License for more details.
////
//// You should have received a copy of the GNU Affero General Public License
//// along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

import fluxer_admin/api/common
import fluxer_admin/api/users
import fluxer_admin/components/ui
import fluxer_admin/web.{type Context, type Session}
import gleam/list
import gleam/option
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn account_tab(
  ctx: Context,
  session: Session,
  user: common.UserLookupResult,
  user_id: String,
) {
  let sessions_result = users.list_user_sessions(ctx, session, user_id)
  h.div([a.class("space-y-6")], [
    ui.card(ui.PaddingMedium, [
      h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
        element.text("Редактирование аккаунта"),
      ]),
      h.div([a.class("grid grid-cols-1 md:grid-cols-2 gap-4")], [
        h.form(
          [
            a.method("POST"),
            a.action("?action=change-username&tab=account"),
            a.class("space-y-2"),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите изменить имя пользователя?')",
            ),
          ],
          [
            h.div([a.class("text-sm font-medium text-neutral-700")], [
              element.text("Изменить имя пользователя:"),
            ]),
            h.input([
              a.type_("text"),
              a.name("username"),
              a.placeholder("Новое имя пользователя"),
              a.required(True),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
              ),
            ]),
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-left",
                ),
              ],
              [element.text("Изменить имя пользователя")],
            ),
          ],
        ),
        h.form(
          [
            a.method("POST"),
            a.action("?action=change-email&tab=account"),
            a.class("space-y-2"),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите изменить Email этого пользователя?')",
            ),
          ],
          [
            h.div([a.class("text-sm font-medium text-neutral-700")], [
              element.text("Изменить Email:"),
            ]),
            h.input([
              a.type_("email"),
              a.name("email"),
              a.placeholder("Новый email"),
              a.required(True),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
              ),
            ]),
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors",
                ),
              ],
              [element.text("Изменить Email")],
            ),
          ],
        ),
        h.form(
          [
            a.method("POST"),
            a.action("?action=change-dob&tab=account"),
            a.class("space-y-2"),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите изменить дату рождения этого пользователя?')",
            ),
          ],
          [
            h.div([a.class("text-sm font-medium text-neutral-700")], [
              element.text("Изменить дату рождения:"),
            ]),
            h.input([
              a.type_("date"),
              a.name("date_of_birth"),
              a.value(option.unwrap(user.date_of_birth, "")),
              a.required(True),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
              ),
            ]),
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors",
                ),
              ],
              [element.text("Изменить дату рождения")],
            ),
          ],
        ),
      ]),
    ]),
    case sessions_result {
      Ok(sessions_response) ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Активные сессии"),
          case list.is_empty(sessions_response.sessions) {
            True ->
              h.p([a.class("text-sm text-neutral-600")], [
                element.text("Нет активных сессий"),
              ])
            False ->
              h.div(
                [a.class("space-y-3")],
                list.map(sessions_response.sessions, fn(session_item) {
                  h.div(
                    [
                      a.class(
                        "bg-neutral-50 border border-neutral-200 rounded-lg p-4",
                      ),
                    ],
                    [
                      h.div(
                        [
                          a.class(
                            "grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm",
                          ),
                        ],
                        [
                          h.div([], [
                            h.div(
                              [a.class("text-neutral-500 text-sm font-medium")],
                              [
                                element.text("Платформа"),
                              ],
                            ),
                            h.div([a.class("text-neutral-900")], [
                              element.text(session_item.client_platform),
                            ]),
                          ]),
                          h.div([], [
                            h.div(
                              [a.class("text-neutral-500 text-sm font-medium")],
                              [
                                element.text("ОС"),
                              ],
                            ),
                            h.div([a.class("text-neutral-900")], [
                              element.text(session_item.client_os),
                            ]),
                          ]),
                          h.div([], [
                            h.div(
                              [a.class("text-neutral-500 text-sm font-medium")],
                              [
                                element.text("Местоположение"),
                              ],
                            ),
                            h.div([a.class("text-neutral-900")], [
                              case session_item.client_location {
                                option.Some(location) -> element.text(location)
                                option.None -> element.text("Неизвестно")
                              },
                            ]),
                          ]),
                          h.div([], [
                            h.div(
                              [a.class("text-neutral-500 text-sm font-medium")],
                              [
                                element.text("IP адрес"),
                              ],
                            ),
                            h.div([a.class("text-neutral-900 text-xs")], [
                              element.text(session_item.client_ip),
                            ]),
                          ]),
                          h.div([], [
                            h.div(
                              [a.class("text-neutral-500 text-sm font-medium")],
                              [
                                element.text("Последнее использование"),
                              ],
                            ),
                            h.div([a.class("text-neutral-900 text-xs")], [
                              element.text(session_item.approx_last_used_at),
                            ]),
                          ]),
                        ],
                      ),
                    ],
                  )
                }),
              )
          },
        ])
      Error(_) -> element.none()
    },
    ui.card(ui.PaddingMedium, [
      h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
        element.text("Быстрые действия"),
      ]),
      h.div([a.class("flex flex-wrap gap-3")], [
        case user.email_verified {
          False ->
            h.form(
              [a.method("POST"), a.action("?action=verify-email&tab=account")],
              [
                h.button(
                  [
                    a.type_("submit"),
                    a.class(
                      "px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-sm",
                    ),
                  ],
                  [element.text("Подтвердить Email")],
                ),
              ],
            )
          True -> element.none()
        },
        case user.phone {
          option.Some(_) ->
            h.form(
              [
                a.method("POST"),
                a.action("?action=unlink-phone&tab=account"),
                a.attribute(
                  "onsubmit",
                  "return confirm('Вы уверены, что хотите отвязать телефон этого пользователя?')",
                ),
              ],
              [
                h.button(
                  [
                    a.type_("submit"),
                    a.class(
                      "px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-sm",
                    ),
                  ],
                  [element.text("Отвязать телефон")],
                ),
              ],
            )
          option.None -> element.none()
        },
        h.form(
          [
            a.method("POST"),
            a.action("?action=send-password-reset&tab=account"),
          ],
          [
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-sm",
                ),
              ],
              [element.text("Отправить сброс пароля")],
            ),
          ],
        ),
      ]),
    ]),
    case
      option.is_some(user.avatar)
      || option.is_some(user.banner)
      || option.is_some(user.bio)
    {
      True ->
        ui.card(ui.PaddingMedium, [
          h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
            element.text("Очистить поля профиля"),
          ]),
          h.form(
            [
              a.method("POST"),
              a.action("?action=clear-fields&tab=account"),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите очистить выбранные поля этого пользователя?')",
              ),
            ],
            [
              h.div([a.class("grid grid-cols-2 md:grid-cols-3 gap-3 mb-4")], [
                case user.avatar {
                  option.Some(_) ->
                    h.label([a.class("flex items-center gap-2 text-sm")], [
                      h.input([
                        a.type_("checkbox"),
                        a.name("fields[]"),
                        a.value("avatar"),
                        a.class("rounded"),
                      ]),
                      element.text("Аватар"),
                    ])
                  option.None -> element.none()
                },
                case user.banner {
                  option.Some(_) ->
                    h.label([a.class("flex items-center gap-2 text-sm")], [
                      h.input([
                        a.type_("checkbox"),
                        a.name("fields[]"),
                        a.value("banner"),
                        a.class("rounded"),
                      ]),
                      element.text("Баннер"),
                    ])
                  option.None -> element.none()
                },
                case user.bio {
                  option.Some(_) ->
                    h.label([a.class("flex items-center gap-2 text-sm")], [
                      h.input([
                        a.type_("checkbox"),
                        a.name("fields[]"),
                        a.value("bio"),
                        a.class("rounded"),
                      ]),
                      element.text("О себе"),
                    ])
                  option.None -> element.none()
                },
                case user.global_name {
                  option.Some(_) ->
                    h.label([a.class("flex items-center gap-2 text-sm")], [
                      h.input([
                        a.type_("checkbox"),
                        a.name("fields[]"),
                        a.value("global_name"),
                        a.class("rounded"),
                      ]),
                      element.text("Отображаемое имя"),
                    ])
                  option.None -> element.none()
                },
              ]),
              h.button(
                [
                  a.type_("submit"),
                  a.class(
                    "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors",
                  ),
                ],
                [element.text("Очистить выбранные поля")],
              ),
            ],
          ),
        ])
      False -> element.none()
    },
    ui.card(ui.PaddingMedium, [
      h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
        element.text("Статус пользователя"),
      ]),
      h.div([a.class("grid grid-cols-1 md:grid-cols-2 gap-4")], [
        h.form(
          [
            a.method("POST"),
            a.action(
              "?action=set-bot-status&status="
              <> case user.bot {
                True -> "false"
                False -> "true"
              }
              <> "&tab=account",
            ),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите "
                <> case user.bot {
                True -> "снять"
                False -> "установить"
              }
                <> " статус бота для этого пользователя?')",
            ),
          ],
          [
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-left",
                ),
              ],
              [
                element.text(case user.bot {
                  True -> "Снять статус бота"
                  False -> "Установить статус бота"
                }),
              ],
            ),
          ],
        ),
        h.form(
          [
            a.method("POST"),
            a.action(
              "?action=set-system-status&status="
              <> case user.system {
                True -> "false"
                False -> "true"
              }
              <> "&tab=account",
            ),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите "
                <> case user.system {
                True -> "снять"
                False -> "установить"
              }
                <> " системный статус для этого пользователя?')",
            ),
          ],
          [
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-left",
                ),
              ],
              [
                element.text(case user.system {
                  True -> "Снять системный статус"
                  False -> "Установить системный статус"
                }),
              ],
            ),
          ],
        ),
      ]),
    ]),
    ui.card(ui.PaddingMedium, [
      h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
        element.text("Действия безопасности"),
      ]),
      h.div([a.class("grid grid-cols-1 md:grid-cols-2 gap-3")], [
        case user.has_totp {
          True ->
            h.form(
              [
                a.method("POST"),
                a.action("?action=disable-mfa&tab=account"),
                a.attribute(
                  "onsubmit",
                  "return confirm('Вы уверены, что хотите отключить MFA/TOTP для этого пользователя?')",
                ),
              ],
              [
                h.button(
                  [
                    a.type_("submit"),
                    a.class(
                      "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-left",
                    ),
                  ],
                  [element.text("Отключить MFA/TOTP")],
                ),
              ],
            )
          False -> element.none()
        },
        h.form(
          [
            a.method("POST"),
            a.action("?action=terminate-sessions&tab=account"),
            a.attribute(
              "onsubmit",
              "return confirm('Вы уверены, что хотите завершить все сессии этого пользователя?')",
            ),
          ],
          [
            h.button(
              [
                a.type_("submit"),
                a.class(
                  "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors text-left",
                ),
              ],
              [element.text("Завершить все сессии")],
            ),
          ],
        ),
      ]),
    ]),
  ])
}
