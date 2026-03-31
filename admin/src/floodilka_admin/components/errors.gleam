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
import floodilka_admin/web.{type Context, href}
import gleam/option
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn error_view(error: common.ApiError) {
  h.div(
    [a.class("bg-red-50 border border-red-200 rounded-lg p-6 text-center")],
    [
      h.p([a.class("text-red-800 text-sm font-medium mb-2")], [
        element.text("Ошибка"),
      ]),
      h.p([a.class("text-red-600")], [
        element.text(case error {
          common.Unauthorized -> "Не авторизован"
          common.Forbidden(msg) -> "Доступ запрещён — " <> msg
          common.NotFound -> "Не найдено"
          common.ServerError -> "Ошибка сервера"
          common.NetworkError -> "Ошибка сети"
        }),
      ]),
    ],
  )
}

pub fn api_error_view(
  ctx: Context,
  err: common.ApiError,
  back_url: option.Option(String),
  back_label: option.Option(String),
) {
  let #(title, message) = case err {
    common.Unauthorized -> #(
      "Требуется авторизация",
      "Сессия истекла. Пожалуйста, войдите снова.",
    )
    common.Forbidden(msg) -> #("Доступ запрещён", msg)
    common.NotFound -> #("Не найдено", "Запрашиваемый ресурс не найден.")
    common.ServerError -> #(
      "Ошибка сервера",
      "Произошла внутренняя ошибка сервера. Попробуйте позже.",
    )
    common.NetworkError -> #(
      "Ошибка сети",
      "Не удалось подключиться к API. Попробуйте позже.",
    )
  }

  h.div([a.class("max-w-4xl mx-auto")], [
    h.div([a.class("bg-red-50 border border-red-200 rounded-lg p-8")], [
      h.div([a.class("flex items-start gap-4")], [
        h.div(
          [
            a.class(
              "flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center",
            ),
          ],
          [
            h.span([a.class("text-red-600 text-base font-semibold")], [
              element.text("!"),
            ]),
          ],
        ),
        h.div([a.class("flex-1")], [
          h.h2([a.class("text-base font-semibold text-red-900 mb-2")], [
            element.text(title),
          ]),
          h.p([a.class("text-red-700 mb-6")], [element.text(message)]),
          case back_url {
            option.Some(url) ->
              h.a(
                [
                  href(ctx, url),
                  a.class(
                    "inline-flex items-center gap-2 px-4 py-2 bg-red-900 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors",
                  ),
                ],
                [
                  h.span([a.class("text-lg")], [element.text("←")]),
                  element.text(option.unwrap(back_label, "Назад")),
                ],
              )
            option.None -> element.none()
          },
        ]),
      ]),
    ]),
  ])
}
