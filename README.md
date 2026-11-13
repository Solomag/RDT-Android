# RDT Android

Модуль Reborn Deck Tracker для Android-порта TESL Reborn. Порт загружает модуль как отдельный опциональный скрипт: Frida + frida-il2cpp-bridge.

План и вехи — в [docs/plan.md](docs/plan.md).

## Устройство
- `src/core/` — подсчёт без зависимостей от Frida и Il2Cpp. Собирается и для телефона, и для тестов в Node.
- `src/frida/` — модуль для телефона: связь с API порта (`globalThis.teslPort`), перехват функций игры, интерфейс.
- `tests/` — тесты в Node (`node --test`). Позже сюда добавятся эталонные записи матчей и логи ПК-версии.

## Команды
```sh
npm ci
npm test                  # сборка ядра для Node и тесты
npm run build             # build/rdt.js — модуль для телефона
```

## Выпуск
Ключ подписи (ed25519) хранится только в секрете GitHub Actions `RDT_SIGNING_KEY`, в репозитории его нет. Публичный ключ вшит в загрузчик порта: `8e8414717e295a6fdafbe517c40cbea6d2b1fc73ed0bd910927e8edfa7d74700`.

Обычный выпуск: Actions → **release** → Run workflow, только с main. Workflow:
1. запускает тесты;
2. подписывает сборку и проверяет, что ключ совпадает с вшитым;
3. коммитит `release/`.

Вручную, если ключ есть локально:

```sh
node tools/keygen.mjs D:/keys/rdt-release.pem      # один раз; публичный ключ вшивается в загрузчик порта
RDT_SIGNING_KEY=D:/keys/rdt-release.pem RDT_CHANNEL_BASE=https://raw.githubusercontent.com/<owner>/<repo>/main/release/ \
  node tools/release.mjs <revision>
```

Скрипт пишет файлы в `release/`:
- `manifest.json` — `{ revision, minCore, bytes, sha256, sig, url }`, где `sig` — подпись ed25519 над строкой `"<sha256>:<revision>"`;
- `payloads/<sha256>.js`.

Чтобы опубликовать выпуск, сделанный вручную, закоммить и запушь `release/`.

Загрузчик порта при скачивании проверяет:
1. подпись — закреплённым публичным ключом;
2. размер и SHA-256 файла;
3. что номер ревизии больше прежнего.
