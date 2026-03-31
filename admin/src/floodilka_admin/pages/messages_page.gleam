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
import floodilka_admin/api/messages
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/message_list
import floodilka_admin/components/ui
import floodilka_admin/web.{type Context, type Session}
import gleam/int
import gleam/list
import gleam/option
import gleam/string
import gleam/uri
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Request, type Response}

pub fn view(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  flash_data: option.Option(flash.Flash),
  admin_acls: List(String),
  lookup_result: option.Option(messages.LookupMessageResponse),
  prefill_channel_id: option.Option(String),
) -> Response {
  let content =
    h.div([a.class("space-y-6")], [
      h.div([a.class("mb-6")], [ui.heading_page("Инструменты сообщений")]),
      case lookup_result {
        option.Some(result) -> render_lookup_result(ctx, result)
        option.None -> element.none()
      },
      case acl.has_permission(admin_acls, "message:lookup") {
        True -> render_lookup_message_form(prefill_channel_id)
        False -> element.none()
      },
      case acl.has_permission(admin_acls, "message:lookup") {
        True -> render_lookup_by_attachment_form()
        False -> element.none()
      },
      case acl.has_permission(admin_acls, "message:delete") {
        True -> render_delete_message_form()
        False -> element.none()
      },
    ])

  let html =
    layout.page(
      "Инструменты сообщений",
      "message-tools",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
    )
  let html_string = element.to_document_string(html)

  let html_with_script =
    string.replace(
      html_string,
      "</body>",
      message_list.deletion_script() <> "</body>",
    )

  wisp.html_response(html_with_script, 200)
}

fn render_lookup_result(ctx: Context, result: messages.LookupMessageResponse) {
  h.div([a.class("bg-white border border-neutral-200 rounded-lg p-6 mb-6")], [
    ui.heading_card_with_margin("Результат поиска"),
    h.div([a.class("mb-4 pb-4 border-b border-neutral-200")], [
      h.span([a.class("text-sm text-neutral-600")], [
        element.text("Искали: "),
      ]),
      h.span([a.class("text-sm text-neutral-900")], [
        element.text(result.message_id),
      ]),
    ]),
    case list.is_empty(result.messages) {
      True ->
        h.div([a.class("text-neutral-600 text-sm")], [
          element.text("Сообщения не найдены."),
        ])
      False -> message_list.render(ctx, result.messages, True)
    },
  ])
}

fn render_lookup_message_form(prefill_channel_id: option.Option(String)) {
  h.div([a.class("bg-white border border-neutral-200 rounded-lg p-6")], [
    ui.heading_card_with_margin("Поиск сообщения"),
    h.form(
      [a.method("POST"), a.action("?action=lookup"), a.class("space-y-4")],
      [
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID канала"),
          ]),
          h.input(
            list.flatten([
              [
                a.type_("text"),
                a.name("channel_id"),
                a.placeholder("123456789"),
                a.required(True),
                a.class(
                  "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
                ),
              ],
              case prefill_channel_id {
                option.Some(cid) -> [a.value(cid)]
                option.None -> []
              },
            ]),
          ),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID сообщения"),
          ]),
          h.input([
            a.type_("text"),
            a.name("message_id"),
            a.placeholder("123456789"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("Лимит контекста (сообщения до и после)"),
          ]),
          h.input([
            a.type_("number"),
            a.name("context_limit"),
            a.value("50"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.button(
          [
            a.type_("submit"),
            a.class(
              "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors",
            ),
          ],
          [element.text("Найти сообщение")],
        ),
      ],
    ),
  ])
}

fn render_lookup_by_attachment_form() {
  h.div([a.class("bg-white border border-neutral-200 rounded-lg p-6")], [
    ui.heading_card_with_margin("Поиск сообщения по вложению"),
    h.form(
      [
        a.method("POST"),
        a.action("?action=lookup-by-attachment"),
        a.class("space-y-4"),
      ],
      [
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID канала"),
          ]),
          h.input([
            a.type_("text"),
            a.name("channel_id"),
            a.placeholder("123456789"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID вложения"),
          ]),
          h.input([
            a.type_("text"),
            a.name("attachment_id"),
            a.placeholder("123456789"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("Имя файла"),
          ]),
          h.input([
            a.type_("text"),
            a.name("filename"),
            a.placeholder("image.png"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("Лимит контекста (сообщения до и после)"),
          ]),
          h.input([
            a.type_("number"),
            a.name("context_limit"),
            a.value("50"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.button(
          [
            a.type_("submit"),
            a.class(
              "w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800 transition-colors",
            ),
          ],
          [element.text("Найти по вложению")],
        ),
      ],
    ),
  ])
}

fn render_delete_message_form() {
  h.div([a.class("bg-white border border-neutral-200 rounded-lg p-6")], [
    ui.heading_card_with_margin("Удалить сообщение"),
    h.form(
      [
        a.method("POST"),
        a.action("?action=delete"),
        a.class("space-y-4"),
        a.attribute(
          "onsubmit",
          "return confirm('Вы уверены, что хотите удалить это сообщение?')",
        ),
      ],
      [
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID канала"),
          ]),
          h.input([
            a.type_("text"),
            a.name("channel_id"),
            a.placeholder("123456789"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("ID сообщения"),
          ]),
          h.input([
            a.type_("text"),
            a.name("message_id"),
            a.placeholder("123456789"),
            a.required(True),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.div([a.class("space-y-2")], [
          h.label([a.class("text-sm font-medium text-neutral-700 mb-2 block")], [
            element.text("Причина для аудита (необязательно)"),
          ]),
          h.input([
            a.type_("text"),
            a.name("audit_log_reason"),
            a.placeholder("Причина удаления"),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm",
            ),
          ]),
        ]),
        h.button(
          [
            a.type_("submit"),
            a.class(
              "w-full px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors",
            ),
          ],
          [element.text("Удалить сообщение")],
        ),
      ],
    ),
  ])
}

pub fn handle_get(
  req: Request,
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  flash_data: option.Option(flash.Flash),
  admin_acls: List(String),
) -> Response {
  let query = wisp.get_query(req)
  let channel_id = list.key_find(query, "channel_id") |> option.from_result
  let message_id = list.key_find(query, "message_id") |> option.from_result
  let attachment_id =
    list.key_find(query, "attachment_id") |> option.from_result
  let filename = list.key_find(query, "filename") |> option.from_result
  let context_limit =
    list.key_find(query, "context_limit")
    |> option.from_result
    |> option.then(fn(s) { int.parse(s) |> option.from_result })
    |> option.unwrap(50)

  case channel_id, attachment_id, filename {
    option.Some(cid), option.Some(aid), option.Some(fname) -> {
      case
        messages.lookup_message_by_attachment(
          ctx,
          session,
          cid,
          aid,
          fname,
          context_limit,
        )
      {
        Ok(result) ->
          view(
            ctx,
            session,
            current_admin,
            flash_data,
            admin_acls,
            option.Some(result),
            option.None,
          )
        Error(_) ->
          view(
            ctx,
            session,
            current_admin,
            flash_data,
            admin_acls,
            option.None,
            option.Some(cid),
          )
      }
    }
    _, _, _ -> {
      case channel_id, message_id {
        option.Some(cid), option.Some(mid) -> {
          case messages.lookup_message(ctx, session, cid, mid, context_limit) {
            Ok(result) ->
              view(
                ctx,
                session,
                current_admin,
                flash_data,
                admin_acls,
                option.Some(result),
                option.None,
              )
            Error(_) ->
              view(
                ctx,
                session,
                current_admin,
                flash_data,
                admin_acls,
                option.None,
                option.Some(cid),
              )
          }
        }
        _, _ ->
          view(
            ctx,
            session,
            current_admin,
            flash_data,
            admin_acls,
            option.None,
            channel_id,
          )
      }
    }
  }
}

pub fn handle_action(
  req: Request,
  ctx: Context,
  session: Session,
  _admin_acls: List(String),
  action: option.Option(String),
) -> Response {
  use form_data <- wisp.require_form(req)

  case action {
    option.Some("lookup") -> {
      let channel_id =
        list.key_find(form_data.values, "channel_id") |> option.from_result
      let message_id =
        list.key_find(form_data.values, "message_id") |> option.from_result
      let context_limit =
        list.key_find(form_data.values, "context_limit")
        |> option.from_result
        |> option.unwrap("50")

      case channel_id, message_id {
        option.Some(cid), option.Some(mid) -> {
          wisp.redirect(web.prepend_base_path(
            ctx,
            "/messages?channel_id="
              <> cid
              <> "&message_id="
              <> mid
              <> "&context_limit="
              <> context_limit,
          ))
        }
        _, _ -> wisp.redirect(web.prepend_base_path(ctx, "/messages"))
      }
    }

    option.Some("lookup-by-attachment") -> {
      let channel_id =
        list.key_find(form_data.values, "channel_id") |> option.from_result
      let attachment_id =
        list.key_find(form_data.values, "attachment_id") |> option.from_result
      let filename =
        list.key_find(form_data.values, "filename") |> option.from_result
      let context_limit =
        list.key_find(form_data.values, "context_limit")
        |> option.from_result
        |> option.unwrap("50")

      case channel_id, attachment_id, filename {
        option.Some(cid), option.Some(aid), option.Some(fname) -> {
          let encoded_filename = uri.percent_encode(fname)
          wisp.redirect(web.prepend_base_path(
            ctx,
            "/messages?channel_id="
              <> cid
              <> "&attachment_id="
              <> aid
              <> "&filename="
              <> encoded_filename
              <> "&context_limit="
              <> context_limit,
          ))
        }
        _, _, _ -> wisp.redirect(web.prepend_base_path(ctx, "/messages"))
      }
    }

    option.Some("delete") -> {
      let channel_id =
        list.key_find(form_data.values, "channel_id") |> option.from_result
      let message_id =
        list.key_find(form_data.values, "message_id") |> option.from_result
      let audit_log_reason =
        list.key_find(form_data.values, "audit_log_reason")
        |> option.from_result

      case channel_id, message_id {
        option.Some(cid), option.Some(mid) -> {
          case
            messages.delete_message(ctx, session, cid, mid, audit_log_reason)
          {
            Ok(_) ->
              wisp.response(200)
              |> wisp.set_header("content-type", "application/json")
              |> wisp.string_body("{\"success\":true}")
            Error(_) ->
              wisp.response(500)
              |> wisp.set_header("content-type", "application/json")
              |> wisp.string_body("{\"success\":false}")
          }
        }
        _, _ ->
          wisp.response(400)
          |> wisp.set_header("content-type", "application/json")
          |> wisp.string_body("{\"success\":false}")
      }
    }

    _ -> wisp.redirect(web.prepend_base_path(ctx, "/messages"))
  }
}
