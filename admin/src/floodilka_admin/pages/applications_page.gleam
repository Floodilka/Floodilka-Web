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
import floodilka_admin/api/applications
import floodilka_admin/api/common
import floodilka_admin/components/errors
import floodilka_admin/components/flash
import floodilka_admin/components/layout
import floodilka_admin/components/ui
import floodilka_admin/constants
import floodilka_admin/web.{type Context, type Session, action}
import gleam/int
import gleam/list
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
  admin_acls: List(String),
  owner_id: option.Option(String),
  generated_token: option.Option(String),
) -> Response {
  let can_list = acl.has_permission(admin_acls, constants.acl_application_list)
  let can_lookup =
    acl.has_permission(admin_acls, constants.acl_application_lookup)

  let content = case can_list || can_lookup {
    False ->
      errors.api_error_view(
        ctx,
        common.Forbidden("Доступ запрещён"),
        option.None,
        option.None,
      )
    True -> {
      case owner_id {
        option.Some(id) ->
          case applications.list_by_owner(ctx, session, id) {
            Ok(apps) ->
              render_page(ctx, flash_data, id, apps, admin_acls, generated_token)
            Error(err) ->
              errors.api_error_view(ctx, err, option.None, option.None)
          }
        option.None ->
          render_page(ctx, flash_data, "", [], admin_acls, generated_token)
      }
    }
  }

  let html =
    layout.page(
      "Приложения и боты",
      "applications",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
    )

  wisp.html_response(element.to_document_string(html), 200)
}

fn render_page(
  ctx: Context,
  flash_data: option.Option(flash.Flash),
  owner_id: String,
  apps: List(applications.Application),
  admin_acls: List(String),
  generated_token: option.Option(String),
) -> element.Element(a) {
  h.div([a.class("max-w-7xl mx-auto space-y-6")], [
    ui.heading_page("Приложения и боты"),
    flash.view(flash_data),
    render_generated_token(generated_token),
    render_lookup_form(ctx, owner_id),
    render_applications_list(ctx, apps, admin_acls),
  ])
}

fn render_generated_token(
  token: option.Option(String),
) -> element.Element(a) {
  case token {
    option.None -> h.div([], [])
    option.Some(t) ->
      ui.card(ui.PaddingMedium, [
        h.div([a.class("space-y-2")], [
          h.h3([a.class("text-sm font-semibold text-neutral-900")], [
            element.text("Новый bot-токен (показывается один раз)"),
          ]),
          h.textarea(
            [
              a.readonly(True),
              a.attribute("rows", "2"),
              a.class(
                "w-full border border-neutral-200 rounded-lg px-4 py-3 font-mono text-sm text-neutral-900 bg-neutral-50",
              ),
            ],
            t,
          ),
          h.p([a.class("text-xs text-neutral-500")], [
            element.text(
              "Скопируйте и передайте владельцу приложения. Предыдущий токен отозван.",
            ),
          ]),
        ]),
      ])
  }
}

fn render_lookup_form(
  ctx: Context,
  owner_id: String,
) -> element.Element(a) {
  ui.card(ui.PaddingMedium, [
    h.form(
      [
        a.method("GET"),
        action(ctx, "/applications"),
        a.class("space-y-4"),
      ],
      [
        h.div([a.class("space-y-1")], [
          h.label([a.class("text-sm font-medium text-neutral-800")], [
            element.text("ID владельца"),
          ]),
          h.input([
            a.type_("text"),
            a.name("owner_user_id"),
            a.value(owner_id),
            a.placeholder("Snowflake ID пользователя-владельца"),
            a.class(
              "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900",
            ),
          ]),
          h.p([a.class("text-xs text-neutral-500")], [
            element.text("Все приложения, принадлежащие этому пользователю."),
          ]),
        ]),
        h.div([a.class("text-right")], [
          ui.button_primary("Найти", "submit", []),
        ]),
      ],
    ),
  ])
}

fn render_applications_list(
  ctx: Context,
  apps: List(applications.Application),
  admin_acls: List(String),
) -> element.Element(a) {
  case apps {
    [] ->
      ui.card_empty([
        h.p([a.class("text-sm text-neutral-500 text-center")], [
          element.text("Приложений не найдено."),
        ]),
      ])
    _ -> {
      let count = list.length(apps)
      h.div([a.class("space-y-4")], [
        h.p([a.class("text-xs uppercase tracking-wide text-neutral-500")], [
          element.text("Приложений: " <> int.to_string(count)),
        ]),
        h.div(
          [a.class("space-y-4")],
          list.map(apps, fn(app) { render_application_card(ctx, app, admin_acls) }),
        ),
      ])
    }
  }
}

fn render_application_card(
  ctx: Context,
  app: applications.Application,
  admin_acls: List(String),
) -> element.Element(a) {
  let can_delete =
    acl.has_permission(admin_acls, constants.acl_application_delete)
  let can_revoke =
    acl.has_permission(admin_acls, constants.acl_application_revoke_bot_token)

  let bot_info = case app.bot {
    option.Some(bot) -> bot.username <> " (ID " <> bot.id <> ")"
    option.None -> "Нет бота"
  }

  let public_label = case app.bot_public {
    True -> "Публичный"
    False -> "Приватный"
  }

  let code_grant_label = case app.bot_require_code_grant {
    True -> "Требует code grant"
    False -> "Без code grant"
  }

  let redirect_uris = string.join(app.redirect_uris, ", ")

  ui.card(ui.PaddingMedium, [
    h.div([a.class("space-y-4")], [
      h.div([a.class("flex items-start justify-between gap-4")], [
        h.div([a.class("space-y-1")], [
          h.h3([a.class("text-lg font-semibold text-neutral-900")], [
            element.text(app.name),
          ]),
          h.p([a.class("text-xs text-neutral-500 font-mono")], [
            element.text("ID " <> app.id),
          ]),
        ]),
        h.div([a.class("flex items-center gap-2")], [
          render_pill(public_label),
          render_pill(code_grant_label),
        ]),
      ]),
      h.dl([a.class("grid grid-cols-1 md:grid-cols-2 gap-3 text-sm")], [
        h.div([], [
          h.dt([a.class("text-xs uppercase text-neutral-500")], [
            element.text("Бот"),
          ]),
          h.dd([a.class("text-neutral-900")], [element.text(bot_info)]),
        ]),
        h.div([], [
          h.dt([a.class("text-xs uppercase text-neutral-500")], [
            element.text("Redirect URIs"),
          ]),
          h.dd([a.class("text-neutral-900 break-all")], [
            element.text(case redirect_uris {
              "" -> "—"
              other -> other
            }),
          ]),
        ]),
      ]),
      h.div([a.class("flex items-center gap-3 pt-2 border-t border-neutral-100")], [
        render_action_form(
          ctx,
          app.id,
          "revoke-bot-token",
          "Отозвать bot-токен",
          can_revoke && option.is_some(app.bot),
          False,
        ),
        render_action_form(
          ctx,
          app.id,
          "delete",
          "Удалить приложение",
          can_delete,
          True,
        ),
      ]),
    ]),
  ])
}

fn render_pill(label: String) -> element.Element(a) {
  h.span(
    [
      a.class(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700",
      ),
    ],
    [element.text(label)],
  )
}

fn render_action_form(
  ctx: Context,
  app_id: String,
  action_name: String,
  label: String,
  enabled: Bool,
  danger: Bool,
) -> element.Element(a) {
  case enabled {
    False -> h.div([], [])
    True ->
      h.form(
        [
          a.method("POST"),
          action(ctx, "/applications?action=" <> action_name),
          a.class(""),
        ],
        [
          h.input([
            a.type_("hidden"),
            a.name("application_id"),
            a.value(app_id),
          ]),
          h.input([
            a.type_("hidden"),
            a.name("owner_user_id"),
            a.value(""),
          ]),
          case danger {
            True -> ui.button_danger(label, "submit", [])
            False -> ui.button_secondary(label, "submit", [])
          },
        ],
      )
  }
}

pub fn handle_action(
  req: Request,
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  admin_acls: List(String),
  action_name: option.Option(String),
) -> Response {
  use form_data <- wisp.require_form(req)

  let application_id =
    list.key_find(form_data.values, "application_id")
    |> option.from_result
  let owner_user_id =
    list.key_find(form_data.values, "owner_user_id")
    |> option.from_result

  case action_name, application_id {
    option.Some("delete"), option.Some(app_id) ->
      handle_delete(ctx, session, current_admin, admin_acls, app_id, owner_user_id)
    option.Some("revoke-bot-token"), option.Some(app_id) ->
      handle_revoke(ctx, session, current_admin, admin_acls, app_id, owner_user_id)
    _, _ ->
      view(
        ctx,
        session,
        current_admin,
        option.Some(flash.Flash("Неизвестное действие", flash.Error)),
        admin_acls,
        owner_user_id,
        option.None,
      )
  }
}

fn handle_delete(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  admin_acls: List(String),
  app_id: String,
  owner_user_id: option.Option(String),
) -> Response {
  case acl.has_permission(admin_acls, constants.acl_application_delete) {
    False ->
      view(
        ctx,
        session,
        current_admin,
        option.Some(flash.Flash("Доступ запрещён", flash.Error)),
        admin_acls,
        owner_user_id,
        option.None,
      )
    True ->
      case applications.delete_application(ctx, session, app_id) {
        Ok(_) ->
          view(
            ctx,
            session,
            current_admin,
            option.Some(flash.Flash(
              "Приложение удалено: " <> app_id,
              flash.Success,
            )),
            admin_acls,
            owner_user_id,
            option.None,
          )
        Error(err) ->
          view(
            ctx,
            session,
            current_admin,
            option.Some(flash.Flash(api_error_message(err), flash.Error)),
            admin_acls,
            owner_user_id,
            option.None,
          )
      }
  }
}

fn handle_revoke(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  admin_acls: List(String),
  app_id: String,
  owner_user_id: option.Option(String),
) -> Response {
  case
    acl.has_permission(admin_acls, constants.acl_application_revoke_bot_token)
  {
    False ->
      view(
        ctx,
        session,
        current_admin,
        option.Some(flash.Flash("Доступ запрещён", flash.Error)),
        admin_acls,
        owner_user_id,
        option.None,
      )
    True ->
      case applications.revoke_bot_token(ctx, session, app_id) {
        Ok(token) ->
          view(
            ctx,
            session,
            current_admin,
            option.Some(flash.Flash(
              "Bot-токен отозван. Новый токен показан выше.",
              flash.Success,
            )),
            admin_acls,
            owner_user_id,
            option.Some(token),
          )
        Error(err) ->
          view(
            ctx,
            session,
            current_admin,
            option.Some(flash.Flash(api_error_message(err), flash.Error)),
            admin_acls,
            owner_user_id,
            option.None,
          )
      }
  }
}

fn api_error_message(err: common.ApiError) -> String {
  case err {
    common.Unauthorized -> "Не авторизован"
    common.Forbidden(message) -> message
    common.NotFound -> "Приложение не найдено"
    common.NetworkError -> "Ошибка сети"
    common.ServerError -> "Ошибка сервера"
  }
}
