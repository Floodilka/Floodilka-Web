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
import floodilka_admin/api/guilds
import floodilka_admin/components/ui
import floodilka_admin/constants
import floodilka_admin/web.{type Context, action}
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn moderation_tab(
  ctx: Context,
  _guild: guilds.GuildLookupResult,
  guild_id: String,
  admin_acls: List(String),
) {
  h.div([a.class("space-y-6")], [
    case acl.has_permission(admin_acls, "guild:update:name") {
      True ->
        ui.card(ui.PaddingMedium, [
          h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
            element.text("Обновить название сервера"),
          ]),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/" <> guild_id <> "?action=update-name&tab=moderation",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите изменить название этого сервера?')",
              ),
            ],
            [
              h.input([
                a.type_("text"),
                a.name("name"),
                a.placeholder("Новое название сервера"),
                a.required(True),
                a.class(
                  "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm mb-3",
                ),
              ]),
              ui.button_primary("Обновить название", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
    case acl.has_permission(admin_acls, "guild:update:vanity") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Обновить Vanity URL"),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/" <> guild_id <> "?action=update-vanity&tab=moderation",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите изменить vanity URL этого сервера?')",
              ),
            ],
            [
              h.input([
                a.type_("text"),
                a.name("vanity_url_code"),
                a.placeholder("vanity-код (оставьте пустым для удаления)"),
                a.class(
                  "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm mb-3",
                ),
              ]),
              ui.button_primary("Обновить Vanity URL", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
    case acl.has_permission(admin_acls, "guild:transfer_ownership") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Передача владения"),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/"
                  <> guild_id
                  <> "?action=transfer-ownership&tab=moderation",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите передать владение этим сервером? Это действие сложно отменить.')",
              ),
            ],
            [
              h.input([
                a.type_("text"),
                a.name("new_owner_id"),
                a.placeholder("ID нового владельца"),
                a.required(True),
                a.class(
                  "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm mb-3",
                ),
              ]),
              ui.button_danger("Передать владение", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
    case acl.has_permission(admin_acls, "guild:force_add_user") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Принудительно добавить пользователя"),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/"
                  <> guild_id
                  <> "?action=force-add-user&tab=moderation",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите принудительно добавить этого пользователя на сервер?')",
              ),
            ],
            [
              h.input([
                a.type_("text"),
                a.name("user_id"),
                a.placeholder("ID пользователя"),
                a.required(True),
                a.class(
                  "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm mb-3",
                ),
              ]),
              ui.button_primary("Добавить", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
    case
      acl.has_permission(admin_acls, "guild:reload")
      || acl.has_permission(admin_acls, "guild:shutdown")
    {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Управление процессом сервера"),
          h.div([a.class("flex flex-wrap gap-3")], [
            case acl.has_permission(admin_acls, "guild:reload") {
              True ->
                h.form(
                  [
                    a.method("POST"),
                    action(
                      ctx,
                      "/guilds/" <> guild_id <> "?action=reload&tab=moderation",
                    ),
                    a.attribute(
                      "onsubmit",
                      "return confirm('Вы уверены, что хотите перезагрузить процесс этого сервера?')",
                    ),
                  ],
                  [
                    ui.button_success("Перезагрузить", "submit", []),
                  ],
                )
              False -> element.none()
            },
            case acl.has_permission(admin_acls, "guild:shutdown") {
              True ->
                h.form(
                  [
                    a.method("POST"),
                    action(
                      ctx,
                      "/guilds/"
                        <> guild_id
                        <> "?action=shutdown&tab=moderation",
                    ),
                    a.attribute(
                      "onsubmit",
                      "return confirm('Вы уверены, что хотите остановить процесс этого сервера?')",
                    ),
                  ],
                  [
                    ui.button_danger("Остановить", "submit", []),
                  ],
                )
              False -> element.none()
            },
          ]),
        ])
      False -> element.none()
    },
    case acl.has_permission(admin_acls, constants.acl_guild_delete) {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Удаление сервера"),
          h.p([a.class("text-sm text-neutral-600 mb-4")], [
            element.text(
              "Удаление сервера безвозвратно удаляет его и все связанные данные. Это действие нельзя отменить.",
            ),
          ]),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/" <> guild_id <> "?action=delete-guild&tab=moderation",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите безвозвратно удалить этот сервер? Это действие нельзя отменить.')",
              ),
            ],
            [
              ui.button_danger("Удалить сервер", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
  ])
}
