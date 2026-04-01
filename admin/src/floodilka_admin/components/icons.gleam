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
