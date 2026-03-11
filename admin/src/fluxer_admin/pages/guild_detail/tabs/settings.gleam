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

import fluxer_admin/acl
import fluxer_admin/api/guilds
import fluxer_admin/components/ui
import fluxer_admin/pages/guild_detail/forms
import fluxer_admin/web.{type Context, action}
import gleam/int
import gleam/list
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn settings_tab(
  ctx: Context,
  guild: guilds.GuildLookupResult,
  guild_id: String,
  admin_acls: List(String),
) {
  h.div([a.class("space-y-6")], [
    case acl.has_permission(admin_acls, "guild:update:settings") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Настройки сервера"),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/" <> guild_id <> "?action=update-settings&tab=settings",
              ),
            ],
            [
              h.div([a.class("grid grid-cols-1 md:grid-cols-2 gap-4")], [
                h.div([], [
                  h.label(
                    [
                      a.class("block text-sm font-medium text-neutral-600 mb-1"),
                    ],
                    [element.text("Уровень верификации")],
                  ),
                  h.select(
                    [
                      a.name("verification_level"),
                      a.class(
                        "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
                      ),
                    ],
                    [
                      option_element("0", "Нет", guild.verification_level == 0),
                      option_element(
                        "1",
                        "Низкий (подтверждённый email)",
                        guild.verification_level == 1,
                      ),
                      option_element(
                        "2",
                        "Средний (5+ минут)",
                        guild.verification_level == 2,
                      ),
                      option_element(
                        "3",
                        "Высокий (10+ минут)",
                        guild.verification_level == 3,
                      ),
                      option_element(
                        "4",
                        "Очень высокий (подтверждённый телефон)",
                        guild.verification_level == 4,
                      ),
                    ],
                  ),
                ]),
                h.div([], [
                  h.label(
                    [
                      a.class("block text-sm font-medium text-neutral-600 mb-1"),
                    ],
                    [element.text("Уровень MFA")],
                  ),
                  h.select(
                    [
                      a.name("mfa_level"),
                      a.class(
                        "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
                      ),
                    ],
                    [
                      option_element("0", "Нет", guild.mfa_level == 0),
                      option_element("1", "Повышенный", guild.mfa_level == 1),
                    ],
                  ),
                ]),
                h.div([], [
                  h.label(
                    [
                      a.class("block text-sm font-medium text-neutral-600 mb-1"),
                    ],
                    [element.text("Уровень NSFW")],
                  ),
                  h.select(
                    [
                      a.name("nsfw_level"),
                      a.class(
                        "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
                      ),
                    ],
                    [
                      option_element("0", "По умолчанию", guild.nsfw_level == 0),
                      option_element("1", "Откровенный", guild.nsfw_level == 1),
                      option_element("2", "Безопасный", guild.nsfw_level == 2),
                      option_element(
                        "3",
                        "Возрастное ограничение",
                        guild.nsfw_level == 3,
                      ),
                    ],
                  ),
                ]),
                h.div([], [
                  h.label(
                    [
                      a.class("block text-sm font-medium text-neutral-600 mb-1"),
                    ],
                    [element.text("Фильтр контента")],
                  ),
                  h.select(
                    [
                      a.name("explicit_content_filter"),
                      a.class(
                        "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
                      ),
                    ],
                    [
                      option_element(
                        "0",
                        "Отключён",
                        guild.explicit_content_filter == 0,
                      ),
                      option_element(
                        "1",
                        "Участники без ролей",
                        guild.explicit_content_filter == 1,
                      ),
                      option_element(
                        "2",
                        "Все участники",
                        guild.explicit_content_filter == 2,
                      ),
                    ],
                  ),
                ]),
                h.div([], [
                  h.label(
                    [
                      a.class("block text-sm font-medium text-neutral-600 mb-1"),
                    ],
                    [element.text("Уведомления по умолчанию")],
                  ),
                  h.select(
                    [
                      a.name("default_message_notifications"),
                      a.class(
                        "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
                      ),
                    ],
                    [
                      option_element(
                        "0",
                        "Все сообщения",
                        guild.default_message_notifications == 0,
                      ),
                      option_element(
                        "1",
                        "Только упоминания",
                        guild.default_message_notifications == 1,
                      ),
                    ],
                  ),
                ]),
              ]),
              h.div([a.class("mt-6 pt-6 border-t border-neutral-200")], [
                ui.button_primary("Сохранить настройки", "submit", []),
              ]),
            ],
          ),
        ])
      False ->
        ui.card(ui.PaddingMedium, [
          h.h2([a.class("text-base font-medium text-neutral-900 mb-4")], [
            element.text("Настройки сервера"),
          ]),
          info_grid([
            #(
              "Уровень верификации",
              verification_level_to_string(guild.verification_level),
            ),
            #("Уровень MFA", mfa_level_to_string(guild.mfa_level)),
            #("Уровень NSFW", nsfw_level_to_string(guild.nsfw_level)),
            #(
              "Фильтр контента",
              content_filter_to_string(guild.explicit_content_filter),
            ),
            #(
              "Уведомления по умолчанию",
              notification_level_to_string(guild.default_message_notifications),
            ),
            #("Таймаут AFK", int.to_string(guild.afk_timeout) <> " секунд"),
          ]),
        ])
    },
    case acl.has_permission(admin_acls, "guild:update:settings") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Отключённые операции"),
          forms.render_disabled_operations_form(
            ctx,
            guild.disabled_operations,
            guild_id,
          ),
        ])
      False ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Отключённые операции"),
          h.p([a.class("text-sm text-neutral-600")], [
            element.text(
              "Значение битовой маски: " <> int.to_string(guild.disabled_operations),
            ),
          ]),
        ])
    },
    case acl.has_permission(admin_acls, "guild:update:settings") {
      True ->
        ui.card(ui.PaddingMedium, [
          ui.heading_card_with_margin("Очистить поля сервера"),
          h.form(
            [
              a.method("POST"),
              action(
                ctx,
                "/guilds/" <> guild_id <> "?action=clear-fields&tab=settings",
              ),
              a.attribute(
                "onsubmit",
                "return confirm('Вы уверены, что хотите очистить эти поля?')",
              ),
            ],
            [
              h.div([a.class("space-y-2 mb-3")], [
                h.label([a.class("flex items-center gap-2")], [
                  h.input([
                    a.type_("checkbox"),
                    a.name("fields"),
                    a.value("icon"),
                  ]),
                  h.span([a.class("text-sm")], [element.text("Иконка")]),
                ]),
                h.label([a.class("flex items-center gap-2")], [
                  h.input([
                    a.type_("checkbox"),
                    a.name("fields"),
                    a.value("banner"),
                  ]),
                  h.span([a.class("text-sm")], [element.text("Баннер")]),
                ]),
                h.label([a.class("flex items-center gap-2")], [
                  h.input([
                    a.type_("checkbox"),
                    a.name("fields"),
                    a.value("splash"),
                  ]),
                  h.span([a.class("text-sm")], [element.text("Заставка")]),
                ]),
              ]),
              ui.button_danger("Очистить выбранные поля", "submit", []),
            ],
          ),
        ])
      False -> element.none()
    },
  ])
}

fn info_grid(items: List(#(String, String))) {
  let info_items =
    list.map(items, fn(item) {
      let #(label, value) = item
      ui.info_item_text(label, value)
    })

  ui.info_grid(info_items)
}

fn verification_level_to_string(level: Int) -> String {
  case level {
    0 -> "Нет"
    1 -> "Низкий (подтверждённый email)"
    2 -> "Средний (зарегистрирован 5 минут)"
    3 -> "Высокий (участник 10 минут)"
    4 -> "Очень высокий (подтверждённый телефон)"
    _ -> "Неизвестно (" <> int.to_string(level) <> ")"
  }
}

fn mfa_level_to_string(level: Int) -> String {
  case level {
    0 -> "Нет"
    1 -> "Повышенный"
    _ -> "Неизвестно (" <> int.to_string(level) <> ")"
  }
}

fn nsfw_level_to_string(level: Int) -> String {
  case level {
    0 -> "По умолчанию"
    1 -> "Откровенный"
    2 -> "Безопасный"
    3 -> "Возрастное ограничение"
    _ -> "Неизвестно (" <> int.to_string(level) <> ")"
  }
}

fn content_filter_to_string(level: Int) -> String {
  case level {
    0 -> "Отключён"
    1 -> "Участники без ролей"
    2 -> "Все участники"
    _ -> "Неизвестно (" <> int.to_string(level) <> ")"
  }
}

fn notification_level_to_string(level: Int) -> String {
  case level {
    0 -> "Все сообщения"
    1 -> "Только упоминания"
    _ -> "Неизвестно (" <> int.to_string(level) <> ")"
  }
}

fn option_element(value: String, label: String, selected: Bool) {
  element.element("option", [a.value(value), a.selected(selected)], [
    element.text(label),
  ])
}
