The frontend looks like an insurance operations system: white surfaces, deep navy text, and a teal accent. Shadows stay light and corners stay tight. Gradients appear only on the public portal. The spec below is the visual language for a new site.

## Personality

This is a working dashboard, not a marketing site. Information is dense, headings are clear, and buttons and tables are easy to scan. Icons are thin and monochrome, matching the text. The main app has no gradients.

## Color

| Role | Color | Where |
|---|---|---|
| Body text | `#041942` | Everywhere |
| Brand | `#5098BA` | Primary buttons, links, active icons |
| Primary button hover | `#22759C` | Teal buttons |
| Text on primary buttons | `#FFFFFF` | |
| Section bar / selected tab | `#005983` | Table headers, form headers, dialog headers, active tabs |
| Sidebar (selected parent) | `#024F7B` | Open main menu item |
| Selected submenu background | `#F5F9FE` | |
| Table header background | `#E6EDF2` | Column headers, inactive tabs, even rows |
| Table border | `#ACC4E4` | Outer frame of a table block |
| Input border | `#707070` | Fields |
| Input background | `#FFFFFF` | |
| Placeholder | `#041942` at 20% opacity | |
| Link | `#4591B5` | |
| Success | `#18B473` | Success text |
| Switch on | `#00CE92` | |
| Switch off | `#E9E9EB` | |
| Error | `#FF0000` | Invalid field border, error text |
| Forgot-password link | `#F2643C` | Login page only |
| Disabled | Fill `#E7E7E7`, button `#D0D0D0` | |
| Row hover | `#024F7B` | Some tables use this as hover text |
| Selected highlight | `#C7E1F4` | |
| Light blue accents | `#C2DCFF`, `#0082CC` | Secondary emphasis |
| Page background | White | |
| Top bar shadow | Black at 10%, 4px blur downward | |

Keyboard focus on the portal is a 3px orange outline, `#F4A800`.

## Type

**Noto Sans** and **Noto Sans Thai** across the product. Sans only, no serif.

- Body: 14px
- Section titles and dialog titles: 16px, bold
- User name in the top bar: 12px, bold
- Status labels: 12px
- Form labels: 14px, bold, line-height 1.4
- Table headers: 14px, bold
- Breadcrumb: 14px, light; the last item is bold
- Every button is bold

## Spacing and radius

- Button radius: `6px`
- Input radius: `4px`
- Card and dialog radius: `8px`
- Login card radius: `16px`
- Page content padding: `28px`; gap between blocks: `24px`
- Inputs: height `40px`, horizontal padding `12px`
- Buttons: height `40px` default, `36px` small, `44px` large
- Top bar: `85px`, fixed to the top
- Sidebar row: `52px`
- Menu icon: `24px` inside a small rounded box
- Checkbox and radio: `16px`
- Switch: `30px` by `19px`, white circular thumb

## Page chrome

**Top bar.** White, light shadow. Left: hamburger, then the logo. Right: bell (red dot when there is a notification), bold user name, role name with a down arrow, circular profile photo at `38px`.

**Sidebar.** White, text `#024F7B`. The selected parent is `#024F7B` with white bold text. The selected child is `#F5F9FE` and bold. Hover on an unselected row is a very light gray (`slate-50`). Collapsed, it is an icon rail about `96px` wide. Expanded, it is at least `316px`.

**Content.** White. Breadcrumb first, then tabs or form blocks.

**Tabs.** The active tab is `#005983` with white text, rounded top corners, flush with the content, and slightly taller. Inactive tabs are `#E6EDF2` with the default text color.

**Section header.** A full-width bar, `#005983`, white, bold, 16px, padding `24px` horizontal and `16px` vertical. Used for form headers, table headers, and dialog titles.

## Components

**Primary button.** Fill `#5098BA`, white bold text, hover `#22759C`. Disabled fill `#D0D0D0`.

**Secondary button.** White fill, 2px border `#5098BA`, same color for the label.

**Link button.** Brand color, underline on hover.

**Input.** Border `#707070`, white fill, height 40px. Focus does not change the border color. Invalid state is a red border `#FF0000`. Disabled fill `#E7E7E7`.

**Checkbox.** Border `#041942`. Checked fill is the same color, with a white check.

**Radio.** Circle border `#041942`, filled center in the same color.

**Table.** Column header fill `#E6EDF2`, bold, columns separated by white rules. Even rows match the header fill; odd rows are white. Hover is a light tint. Cell padding is `12px` vertical and `20px` horizontal. Text wraps. The outer frame is `#ACC4E4` with a small radius.

**Pagination.** Bar fill `#F4F4F5`, gray text `#808080`, bold and underlined, aligned right. Shows rows per page. The page number sits in a small field, `25×27px`.

**Dialog.** White, 8px radius, medium shadow, 50% dark overlay. Header bar `#005983`. Close control is a white circle at the top right. Max width about `924px`. Result dialogs (success or error) have no header bar: a centered icon around `105px`, 18px bold message, and an OK button below.

**Card.** White, thin border, very light shadow, 8px radius, `24px` padding.

**Password-expiry notice.** Light red fill, red text.

**Loading.** White overlay at about 45% opacity, with a brand-colored square that jumps.

## Login

A thin top strip, about `64–80px`, with the logo only. The background is a full-bleed image. An insurance illustration sits on the left and hides on small screens. On the right, a card at 80% white, 16px radius, and a very wide shadow. Logo centered on top. Fields have an icon inside on the left. The Login button is full width in the brand color. Forgot Password is orange, `#F2643C`.

## Public portal (a separate look)

Use this set only for a public-facing page. It is more colorful than the working app.

- Outer background `#EDF4F3`, text `#123247`
- Center frame at 86% white, max width `1220px`, side shadow in navy `#0B3043`
- Header gradient `#064264` → `#056782` → `#0B93A8`, bottom radius `17px`
- Logo sits in a white card overlapping the header, 3px border `#0B5674`, radius `18px`
- Call-center number is large, white, extra bold, with wide letter-spacing
- Content cards are white, radius `13px`, light shadow
- Each card header has its own color plus a header image: teal `#008EAA`, green `#91C518`, yellow `#FFB306`, gray-blue `#5A9BA4`, purple `#8C5AA4`, sky `#35A5D1`, blue `#126DB4`
- Card bodies are a pale pair of the header: light blue `#DBECF3`, light green `#EFF6DE`, cream `#FEF4E1`
- Links `#036D9E`, underlined, hover `#014B75`
- NEW badge: red `#ED1C24`, white, very small
- Notice frame is a dashed orange line `#F39B00`; the notice badge gradients `#FF3C1C` → `#FF8C4F`
- Enter button is white, 4px border `#30B5CA`, radius only on the right side

Take the colors, type, radii, buttons, tables, and tabs above as the working-app reference. Use the portal set when the new site needs a public page with more color.