# pocketChat
## Roadmap della app del Branco

To launch the chat locally

    docker compose up

To modify the chat, edit

    pb_public/index.html

### next steps
- [ ] test chat on ipad
- [ ] test chat on android
- [ ] dates do not appear on some devices (instead of date there is "invalid date"
- [ ] display day as a row, only times inside messages
- [ ] when reopening the chat from sleep, go to the last unread message without the need of reloading the page
- [ ] when opening the chat display the number of unread messages
- [x] improved UI (avatars, message menu)
- [x] dark mode
- [x] link should render correctly (ie you can click on them)
- [x] edit message by owner
- [x] delete message by owner
- [x] use max real estate width for messages
- [x] add padding at the bottom of the last message (or add padding at the top of the input bar)
- [x] remove message input highlight
- [x] update "a" tag css (visited links, not visited etc.)
- [-] cleanup svgs
- [?] automatic scroll disable when reading old messages

## midterm
- [ ] open menu from the bottom in mobile screens to save realestate
- [ ] search all messages at the top
- [ ] reply to a message
- [ ] more improved ui (top bar, sidebar)
- [ ] multiple rooms
- [ ] load only last NN messages (then use pagination)
- [ ] pin a message (admins only)
- [ ] reset password mechanism
- [ ] reactions on messages (emoticon)
