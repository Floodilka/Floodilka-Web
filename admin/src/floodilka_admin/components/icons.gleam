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

import lustre/attribute as a
import lustre/element

pub fn paperclip_icon(color: String) {
  element.element(
    "svg",
    [
      a.attribute("xmlns", "http://www.w3.org/2000/svg"),
      a.attribute("viewBox", "0 0 256 256"),
      a.class("w-3 h-3 inline-block " <> color),
    ],
    [
      element.element(
        "rect",
        [
          a.attribute("width", "256"),
          a.attribute("height", "256"),
          a.attribute("fill", "none"),
        ],
        [],
      ),
      element.element(
        "path",
        [
          a.attribute(
            "d",
            "M108.71,197.23l-5.11,5.11a46.63,46.63,0,0,1-66-.05h0a46.63,46.63,0,0,1,.06-65.89L72.4,101.66a46.62,46.62,0,0,1,65.94,0h0A46.34,46.34,0,0,1,150.78,124",
          ),
          a.attribute("fill", "none"),
          a.attribute("stroke", "currentColor"),
          a.attribute("stroke-linecap", "round"),
          a.attribute("stroke-linejoin", "round"),
          a.attribute("stroke-width", "24"),
        ],
        [],
      ),
      element.element(
        "path",
        [
          a.attribute(
            "d",
            "M147.29,58.77l5.11-5.11a46.62,46.62,0,0,1,65.94,0h0a46.62,46.62,0,0,1,0,65.94L193.94,144,183.6,154.34a46.63,46.63,0,0,1-66-.05h0A46.46,46.46,0,0,1,105.22,132",
          ),
          a.attribute("fill", "none"),
          a.attribute("stroke", "currentColor"),
          a.attribute("stroke-linecap", "round"),
          a.attribute("stroke-linejoin", "round"),
          a.attribute("stroke-width", "24"),
        ],
        [],
      ),
    ],
  )
}

pub fn checkmark_icon(color: String) {
  element.element(
    "svg",
    [
      a.attribute("xmlns", "http://www.w3.org/2000/svg"),
      a.attribute("viewBox", "0 0 256 256"),
      a.class("w-4 h-4 inline-block " <> color),
    ],
    [
      element.element(
        "rect",
        [
          a.attribute("width", "256"),
          a.attribute("height", "256"),
          a.attribute("fill", "none"),
        ],
        [],
      ),
      element.element(
        "polyline",
        [
          a.attribute("points", "40 144 96 200 224 72"),
          a.attribute("fill", "none"),
          a.attribute("stroke", "currentColor"),
          a.attribute("stroke-linecap", "round"),
          a.attribute("stroke-linejoin", "round"),
          a.attribute("stroke-width", "24"),
        ],
        [],
      ),
    ],
  )
}

pub fn x_icon(color: String) {
  element.element(
    "svg",
    [
      a.attribute("xmlns", "http://www.w3.org/2000/svg"),
      a.attribute("viewBox", "0 0 256 256"),
      a.class("w-4 h-4 inline-block " <> color),
    ],
    [
      element.element(
        "rect",
        [
          a.attribute("width", "256"),
          a.attribute("height", "256"),
          a.attribute("fill", "none"),
        ],
        [],
      ),
      element.element(
        "line",
        [
          a.attribute("x1", "200"),
          a.attribute("y1", "56"),
          a.attribute("x2", "56"),
          a.attribute("y2", "200"),
          a.attribute("fill", "none"),
          a.attribute("stroke", "currentColor"),
          a.attribute("stroke-linecap", "round"),
          a.attribute("stroke-linejoin", "round"),
          a.attribute("stroke-width", "24"),
        ],
        [],
      ),
      element.element(
        "line",
        [
          a.attribute("x1", "200"),
          a.attribute("y1", "200"),
          a.attribute("x2", "56"),
          a.attribute("y2", "56"),
          a.attribute("fill", "none"),
          a.attribute("stroke", "currentColor"),
          a.attribute("stroke-linecap", "round"),
          a.attribute("stroke-linejoin", "round"),
          a.attribute("stroke-width", "24"),
        ],
        [],
      ),
    ],
  )
}

fn svg24(color: String, children: List(element.Element(a))) {
  element.element("svg", [
    a.attribute("xmlns", "http://www.w3.org/2000/svg"),
    a.attribute("viewBox", "0 0 24 24"),
    a.attribute("fill", "none"),
    a.attribute("stroke", "currentColor"),
    a.attribute("stroke-width", "2"),
    a.attribute("stroke-linecap", "round"),
    a.attribute("stroke-linejoin", "round"),
    a.class("w-4 h-4 inline-block " <> color),
  ], children)
}

pub fn mobile_icon(color: String) {
  svg24(color, [
    element.element("rect", [a.attribute("x", "5"), a.attribute("y", "2"), a.attribute("width", "14"), a.attribute("height", "20"), a.attribute("rx", "2"), a.attribute("ry", "2")], []),
    element.element("line", [a.attribute("x1", "12"), a.attribute("y1", "18"), a.attribute("x2", "12.01"), a.attribute("y2", "18")], []),
  ])
}

pub fn android_icon(color: String) {
  element.element("svg", [
    a.attribute("xmlns", "http://www.w3.org/2000/svg"),
    a.attribute("viewBox", "0 0 24 24"),
    a.attribute("fill", "currentColor"),
    a.class("w-4 h-4 inline-block " <> color),
  ], [
    element.element("path", [a.attribute("d", "M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z")], []),
  ])
}

pub fn ios_icon(color: String) {
  element.element("svg", [
    a.attribute("xmlns", "http://www.w3.org/2000/svg"),
    a.attribute("viewBox", "0 0 24 24"),
    a.attribute("fill", "currentColor"),
    a.class("w-4 h-4 inline-block " <> color),
  ], [
    element.element("path", [a.attribute("d", "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.71.85-1.86 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z")], []),
  ])
}

pub fn desktop_icon(color: String) {
  svg24(color, [
    element.element("rect", [a.attribute("x", "2"), a.attribute("y", "3"), a.attribute("width", "20"), a.attribute("height", "14"), a.attribute("rx", "2"), a.attribute("ry", "2")], []),
    element.element("line", [a.attribute("x1", "8"), a.attribute("y1", "21"), a.attribute("x2", "16"), a.attribute("y2", "21")], []),
    element.element("line", [a.attribute("x1", "12"), a.attribute("y1", "17"), a.attribute("x2", "12"), a.attribute("y2", "21")], []),
  ])
}

pub fn mic_off_icon(color: String) {
  svg24(color, [
    element.element("line", [a.attribute("x1", "1"), a.attribute("y1", "1"), a.attribute("x2", "23"), a.attribute("y2", "23")], []),
    element.element("path", [a.attribute("d", "M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6")], []),
    element.element("path", [a.attribute("d", "M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18")], []),
    element.element("line", [a.attribute("x1", "12"), a.attribute("y1", "19"), a.attribute("x2", "12"), a.attribute("y2", "23")], []),
    element.element("line", [a.attribute("x1", "8"), a.attribute("y1", "23"), a.attribute("x2", "16"), a.attribute("y2", "23")], []),
  ])
}

pub fn headphones_off_icon(color: String) {
  svg24(color, [
    element.element("path", [a.attribute("d", "M3 18v-6a9 9 0 0 1 18 0v6")], []),
    element.element("path", [a.attribute("d", "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z")], []),
    element.element("path", [a.attribute("d", "M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z")], []),
    element.element("line", [a.attribute("x1", "1"), a.attribute("y1", "1"), a.attribute("x2", "23"), a.attribute("y2", "23")], []),
  ])
}

pub fn video_icon(color: String) {
  svg24(color, [
    element.element("polygon", [a.attribute("points", "23 7 16 12 23 17 23 7")], []),
    element.element("rect", [a.attribute("x", "1"), a.attribute("y", "5"), a.attribute("width", "15"), a.attribute("height", "14"), a.attribute("rx", "2"), a.attribute("ry", "2")], []),
  ])
}

pub fn monitor_icon(color: String) {
  svg24(color, [
    element.element("rect", [a.attribute("x", "2"), a.attribute("y", "3"), a.attribute("width", "20"), a.attribute("height", "14"), a.attribute("rx", "2"), a.attribute("ry", "2")], []),
    element.element("line", [a.attribute("x1", "8"), a.attribute("y1", "21"), a.attribute("x2", "16"), a.attribute("y2", "21")], []),
    element.element("line", [a.attribute("x1", "12"), a.attribute("y1", "17"), a.attribute("x2", "12"), a.attribute("y2", "21")], []),
  ])
}
