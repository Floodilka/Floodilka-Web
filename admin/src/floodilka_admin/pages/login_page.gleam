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

import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, href}
import gleam/option.{type Option, None, Some}
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Response}

pub fn view(ctx: Context, error: Option(String)) -> Response {
  let html =
    h.html([a.attribute("lang", "en")], [
      layout.build_head("Вход в админку", ctx),
      h.body(
        [
          a.class(
            "min-h-screen bg-neutral-50 flex items-center justify-center p-4",
          ),
        ],
        [
          h.div([a.class("w-full max-w-sm")], [
            h.div(
              [
                a.class(
                  "bg-white border border-neutral-200 rounded-lg p-8 space-y-6",
                ),
              ],
              [
                h.h1(
                  [a.class("text-xl text-sm font-medium text-neutral-900 mb-6")],
                  [
                    element.text("Вход в админку"),
                  ],
                ),
                case error {
                  Some(msg) ->
                    h.div(
                      [
                        a.class(
                          "bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm",
                        ),
                      ],
                      [element.text(msg)],
                    )
                  None -> element.none()
                },
                h.a([href(ctx, "/auth/start")], [
                  ui.button(
                    "Войти через Флудилку",
                    "button",
                    ui.Primary,
                    ui.Medium,
                    ui.Full,
                    [],
                  ),
                ]),
              ],
            ),
          ]),
        ],
      ),
      element.none(),
    ])

  wisp.html_response(element.to_document_string(html), 200)
}
