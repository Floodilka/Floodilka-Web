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

import gleam/int
import gleam/list
import gleam/string
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn vip_checkbox(checked: Bool) {
  h.div([a.class("space-y-1")], [
    h.label([a.class("flex items-center gap-2")], [
      h.input([
        a.type_("checkbox"),
        a.name("vip_only"),
        a.value("true"),
        a.checked(checked),
      ]),
      h.span([a.class("text-sm text-neutral-700")], [
        element.text("Требовать функцию VIP_VOICE"),
      ]),
    ]),
    h.p([a.class("text-xs text-neutral-500 ml-6")], [
      element.text(
        "Когда включено, серверы ДОЛЖНЫ иметь функцию VIP_VOICE. Это базовое требование, работающее по логике И вместе с другими ограничениями.",
      ),
    ]),
  ])
}

pub fn features_field(current_features: List(String)) {
  h.div([a.class("space-y-1")], [
    h.label([a.class("text-sm text-neutral-700")], [
      element.text("Разрешённые функции сервера (логика ИЛИ)"),
    ]),
    h.textarea(
      [
        a.name("required_guild_features"),
        a.placeholder("VANITY_URL, COMMUNITY, PARTNERED"),
        a.attribute("rows", "2"),
        a.class(
          "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
        ),
      ],
      string.join(current_features, ", "),
    ),
    h.p([a.class("text-xs text-neutral-500")], [
      element.text(
        "Через запятую. Серверу нужна ЛЮБАЯ ОДНА из этих функций. Оставьте пустым, если ограничений по функциям нет.",
      ),
    ]),
  ])
}

pub fn guild_ids_field(current_ids: List(String)) {
  h.div([a.class("space-y-1")], [
    h.label([a.class("text-sm text-neutral-700")], [
      element.text("Разрешённые ID серверов (логика ИЛИ, обходит другие проверки)"),
    ]),
    h.textarea(
      [
        a.name("allowed_guild_ids"),
        a.placeholder("123456789012345678, 987654321098765432"),
        a.attribute("rows", "2"),
        a.class(
          "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
        ),
      ],
      string.join(current_ids, ", "),
    ),
    h.p([a.class("text-xs text-neutral-500")], [
      element.text(
        "Через запятую. Если ID сервера совпадает с ЛЮБЫМ из этих, доступ предоставляется сразу (обходит проверки VIP и функций).",
      ),
    ]),
  ])
}

pub fn access_logic_summary() {
  h.div(
    [
      a.class(
        "mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-2",
      ),
    ],
    [
      h.p([a.class("text-sm font-medium text-blue-900")], [
        element.text("Логика доступа:"),
      ]),
      h.ul([a.class("text-blue-800 space-y-1 ml-4 list-disc")], [
        h.li([], [
          element.text(
            "ID серверов дают немедленный доступ (обходят все другие проверки)",
          ),
        ]),
        h.li([], [
          element.text(
            "Требование VIP_VOICE: базовое требование, которое должно быть выполнено (логика И)",
          ),
        ]),
        h.li([], [
          element.text(
            "Функции: серверу нужна ЛЮБАЯ ОДНА из перечисленных функций (логика ИЛИ)",
          ),
        ]),
        h.li([], [
          element.text(
            "Комбинация: VIP_VOICE (если задано) И (функция1 ИЛИ функция2 ИЛИ ...)",
          ),
        ]),
      ]),
    ],
  )
}

pub fn restriction_fields(
  vip_only: Bool,
  features: List(String),
  guild_ids: List(String),
) {
  element.fragment([
    vip_checkbox(vip_only),
    features_field(features),
    guild_ids_field(guild_ids),
    access_logic_summary(),
  ])
}

pub fn info_item(label: String, value: String) {
  h.div([], [
    h.p([a.class("text-xs text-neutral-600")], [element.text(label)]),
    h.p([a.class("text-sm text-neutral-900")], [element.text(value)]),
  ])
}

pub fn vip_badge() {
  h.span(
    [
      a.class("px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded"),
    ],
    [element.text("ТОЛЬКО VIP")],
  )
}

pub fn feature_gated_badge() {
  h.span(
    [
      a.class("px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded"),
    ],
    [element.text("ОГРАНИЧЕНО ФУНКЦИЕЙ")],
  )
}

pub fn guild_restricted_badge() {
  h.span(
    [
      a.class("px-2 py-1 bg-green-100 text-green-800 text-xs rounded"),
    ],
    [element.text("ОГРАНИЧЕНО СЕРВЕРОМ")],
  )
}

pub fn status_badges(vip_only: Bool, has_features: Bool, has_guild_ids: Bool) {
  h.div([a.class("flex items-center gap-2 flex-wrap")], [
    case vip_only {
      True -> vip_badge()
      False -> element.none()
    },
    case has_features {
      True -> feature_gated_badge()
      False -> element.none()
    },
    case has_guild_ids {
      True -> guild_restricted_badge()
      False -> element.none()
    },
  ])
}

pub fn features_list(features: List(String)) {
  case list.is_empty(features) {
    True -> element.none()
    False ->
      h.div([a.class("mb-3")], [
        h.p([a.class("text-xs text-neutral-700 mb-1")], [
          element.text("Разрешённые функции сервера:"),
        ]),
        h.div(
          [a.class("flex flex-wrap gap-1")],
          list.map(features, fn(feature) {
            h.span(
              [
                a.class(
                  "px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded",
                ),
              ],
              [element.text(feature)],
            )
          }),
        ),
      ])
  }
}

pub fn guild_ids_list(guild_ids: List(String)) {
  case list.is_empty(guild_ids) {
    True -> element.none()
    False ->
      h.div([a.class("mb-3")], [
        h.p([a.class("text-xs text-neutral-700 mb-1")], [
          element.text(
            "Разрешённые ID серверов ("
            <> int.to_string(list.length(guild_ids))
            <> "):",
          ),
        ]),
        h.details([a.class("text-xs text-neutral-600")], [
          h.summary([a.class("cursor-pointer hover:text-neutral-900")], [
            element.text("Показать ID"),
          ]),
          h.div(
            [a.class("mt-1 max-h-20 overflow-y-auto text-xs")],
            list.map(guild_ids, fn(id) { h.div([], [element.text(id)]) }),
          ),
        ]),
      ])
  }
}
