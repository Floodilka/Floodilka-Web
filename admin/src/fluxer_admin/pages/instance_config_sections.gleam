import fluxer_admin/api/instance_config
import fluxer_admin/components/ui
import fluxer_admin/web.{type Context, action}
import gleam/list
import gleam/option
import gleam/order
import gleam/string
import lustre/attribute as a
import lustre/element
import lustre/element/html as h

pub fn render_config_form(
  ctx: Context,
  config: instance_config.InstanceConfig,
) -> element.Element(a) {
  ui.card(ui.PaddingMedium, [
    ui.heading_card_with_margin("Настройки вебхуков"),
    h.p([a.class("text-sm text-neutral-600 mb-4")], [
      element.text(
        "Настройте URL вебхуков для получения уведомлений о регистрациях и системных событиях.",
      ),
    ]),
    h.form(
      [
        a.method("POST"),
        action(ctx, "/instance-config?action=update"),
        a.class("space-y-6"),
      ],
      [
        h.div([a.class("space-y-4")], [
          h.div([a.class("space-y-1")], [
            h.label(
              [
                a.for("registration_alerts_webhook_url"),
                a.class("text-sm font-medium text-neutral-700"),
              ],
              [element.text("URL вебхука уведомлений о регистрации")],
            ),
            h.input([
              a.type_("url"),
              a.name("registration_alerts_webhook_url"),
              a.id("registration_alerts_webhook_url"),
              a.value(config.registration_alerts_webhook_url),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
              ),
            ]),
            h.p([a.class("text-xs text-neutral-500 mt-1")], [
              element.text(
                "URL вебхука для получения уведомлений о новых регистрациях.",
              ),
            ]),
          ]),
          h.div([a.class("space-y-1")], [
            h.label(
              [
                a.for("system_alerts_webhook_url"),
                a.class("text-sm font-medium text-neutral-700"),
              ],
              [element.text("URL вебхука системных уведомлений")],
            ),
            h.input([
              a.type_("url"),
              a.name("system_alerts_webhook_url"),
              a.id("system_alerts_webhook_url"),
              a.value(config.system_alerts_webhook_url),
              a.class(
                "w-full px-3 py-2 border border-neutral-300 rounded text-sm",
              ),
            ]),
            h.p([a.class("text-xs text-neutral-500 mt-1")], [
              element.text(
                "URL вебхука для системных уведомлений (ошибки антивируса и т.д.).",
              ),
            ]),
          ]),
        ]),
        h.div([a.class("pt-4 border-t border-neutral-200")], [
          ui.button_primary("Сохранить конфигурацию", "submit", []),
        ]),
      ],
    ),
  ])
}

pub fn render_snowflake_reservation_section(
  ctx: Context,
  reservations: List(instance_config.SnowflakeReservation),
  can_manage: Bool,
) -> element.Element(a) {
  let sorted_reservations =
    reservations
    |> list.sort(fn(a, b) {
      case string.compare(a.email, b.email) {
        order.Lt -> order.Lt
        order.Gt -> order.Gt
        order.Eq -> order.Eq
      }
    })

  ui.card(ui.PaddingMedium, [
    ui.heading_card_with_margin("Резервации Snowflake"),
    h.p([a.class("text-sm text-neutral-500 mb-4")], [
      element.text(
        "Зарезервируйте конкретные snowflake ID для доверенных тестировщиков. Каждая резервация привязывает нормализованный email к фиксированному ID.",
      ),
    ]),
    render_snowflake_reservation_table(ctx, sorted_reservations, can_manage),
    case can_manage {
      True -> render_add_snowflake_reservation_form(ctx)
      False ->
        h.p([a.class("text-sm text-neutral-500 italic")], [
          element.text(
            "У вас недостаточно прав для управления резервациями.",
          ),
        ])
    },
  ])
}

fn render_snowflake_reservation_table(
  ctx: Context,
  reservations: List(instance_config.SnowflakeReservation),
  can_manage: Bool,
) -> element.Element(a) {
  let rows = case list.is_empty(reservations) {
    True -> [
      h.tr([], [
        h.td(
          [a.class("px-6 py-4 text-sm text-neutral-500 italic"), a.colspan(4)],
          [element.text("Резервации не настроены")],
        ),
      ]),
    ]
    False ->
      list.map(reservations, fn(entry) {
        render_reservation_row(ctx, entry, can_manage)
      })
  }

  ui.table_container([
    h.table([a.class("min-w-full divide-y divide-neutral-200")], [
      h.thead([a.class("bg-neutral-50")], [
        h.tr([], [
          ui.table_header_cell("Email"),
          ui.table_header_cell("Snowflake"),
          ui.table_header_cell("Обновлено"),
          ui.table_header_cell("Действия"),
        ]),
      ]),
      h.tbody([a.class("bg-white divide-y divide-neutral-200")], rows),
    ]),
  ])
}

fn render_reservation_row(
  ctx: Context,
  entry: instance_config.SnowflakeReservation,
  can_manage: Bool,
) -> element.Element(a) {
  h.tr([a.class("hover:bg-neutral-50 transition-colors")], [
    h.td([a.class(ui.table_cell_class <> " text-sm text-neutral-900")], [
      element.text(entry.email),
    ]),
    h.td([a.class(ui.table_cell_class)], [element.text(entry.snowflake)]),
    h.td([a.class(ui.table_cell_class)], [
      case entry.updated_at {
        option.Some(updated) -> element.text(updated)
        option.None ->
          h.span([a.class("text-neutral-400 italic")], [element.text("—")])
      },
    ]),
    h.td([a.class(ui.table_cell_class)], [
      case can_manage {
        True -> render_reservation_action_form(ctx, entry.email)
        False ->
          h.span([a.class("text-neutral-400 italic")], [element.text("—")])
      },
    ]),
  ])
}

fn render_reservation_action_form(
  ctx: Context,
  email: String,
) -> element.Element(a) {
  h.form(
    [
      a.method("POST"),
      action(ctx, "/instance-config?action=delete-reservation"),
      a.class("flex items-center gap-2"),
    ],
    [
      h.input([a.type_("hidden"), a.name("reservation_email"), a.value(email)]),
      ui.button_danger("Удалить", "submit", []),
    ],
  )
}

fn render_add_snowflake_reservation_form(ctx: Context) -> element.Element(a) {
  h.form(
    [
      a.method("POST"),
      action(ctx, "/instance-config?action=add-reservation"),
      a.class("space-y-4"),
    ],
    [
      h.div([a.class("grid grid-cols-1 gap-4 md:grid-cols-2")], [
        h.div([a.class("space-y-1")], [
          h.label(
            [
              a.for("reservation_email"),
              a.class("text-sm font-medium text-neutral-700"),
            ],
            [element.text("Email (нормализованный)")],
          ),
          h.input([
            a.type_("email"),
            a.name("reservation_email"),
            a.id("reservation_email"),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500",
            ),
          ]),
        ]),
        h.div([a.class("space-y-1")], [
          h.label(
            [
              a.for("reservation_snowflake"),
              a.class("text-sm font-medium text-neutral-700"),
            ],
            [element.text("Snowflake ID")],
          ),
          h.input([
            a.type_("text"),
            a.name("reservation_snowflake"),
            a.id("reservation_snowflake"),
            a.class(
              "w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500",
            ),
          ]),
        ]),
      ]),
      h.p([a.class("text-sm text-neutral-500")], [
        element.text(
          "Используйте нормализованные email-адреса (в нижнем регистре) при резервации snowflake ID.",
        ),
      ]),
      ui.button_primary("Зарезервировать Snowflake", "submit", []),
    ],
  )
}
