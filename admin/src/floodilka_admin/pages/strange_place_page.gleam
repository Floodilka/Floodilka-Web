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
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session}
import gleam/option.{type Option}
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Response}

pub fn view(
  ctx: Context,
  session: Session,
  current_admin: Option(common.UserLookupResult),
  flash_data: Option(flash.Flash),
) -> Response {
  let content =
    h.div([a.class("max-w-2xl mx-auto")], [
      ui.heading_page("Вы оказались в странном месте..."),
      ui.card(ui.PaddingMedium, [
        ui.stack("4", [
          h.p([a.class("text-neutral-700 leading-relaxed")], [
            element.text(
              "Ваш аккаунт авторизован, но для ваших текущих прав нет доступных разделов администрирования.",
            ),
          ]),
          h.p([a.class("text-neutral-600 leading-relaxed")], [
            element.text(
              "Если вы считаете, что это ошибка, обратитесь к администратору для получения необходимого доступа.",
            ),
          ]),
        ]),
      ]),
    ])

  let html =
    layout.page(
      "Странное место",
      "strange-place",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
    )

  wisp.html_response(element.to_document_string(html), 200)
}
