# NUPP Google Calendar Sync

[![Docker Pulls](https://img.shields.io/docker/pulls/jermorg/nupp-google-calendar?style=for-the-badge&logo=docker)](https://hub.docker.com/r/jermorg/nupp-google-calendar)
[![Docker Image Version](https://img.shields.io/docker/v/jermorg/nupp-google-calendar?style=for-the-badge&logo=docker)](https://hub.docker.com/r/jermorg/nupp-google-calendar)

>Автоматичний сервіс для фонової синхронізації розкладу Полтавської політехніки (НУПП) з вашим Google Календарем.

1. Створіть локальну папку `data` поруч із `docker-compose.yml`.
2. Покладіть файл ключів Google Service Account (`service-account.json`) у папку `./data/service-account.json`.
3. Надайте Сервісному Акаунту (його email-адресі) права на редагування у налаштуваннях вашого Google Календаря.

## Приклад docker-compose.yml
```yml
services:
  nupp-google-calendar:
    image: jermorg/nupp-google-calendar:latest
    container_name: nupp-google-calendar
    restart: unless-stopped
    environment:
      - CALENDAR_ID=google_calendar_id
      - USER_NAME=portal_login
      - USER_PASSWORD=portal_password
      - DATE_START=2026-9-1
      - DATE_END=2026-9-30
    volumes:
      - ./data:/app/data
```

## Змінні оточення
| Змінна | Обов'язкова | Дефолтне значення | Опис |
|---|:---:|:---:|---|
| **`CALENDAR_ID`** | **Так** |  | Унікальний ID вашого Google Календаря (знаходиться в налаштуваннях календаря). |
| **`USER_NAME`** | **Так** |  | Логін від порталу NUPP. |
| **`USER_PASSWORD`** | **Так** |  | Пароль від акаунта NUPP. |
| **`INTERVAL`** | Ні | `60` | Інтервал автоматичної перевірки розкладу у **хвилинах**. |
| **`DATE_START`** | Ні | *Поточний день* | Початкова дата для синхронізації у форматі `YYYY-MM-DD` (наприклад, `2026-09-01`). Якщо залишити порожнім: береться поточна дата. |
| **`DATE_END`** | Ні | *1 тиждень* | Кінцева дата синхронізації у форматі `YYYY-MM-DD` (наприклад, `2026-12-31`). Якщо порожньо: бере весь тиждень. |
| **`BLOCK_HIDDEN_LESSONS`** | Ні | `true` | `true`: ігнорувати та не додавати до календаря пари, які позначені як приховані/скасовані. `false`: додавати всі пари без винятку. |
| **`KEY_FILE`** | Ні | `/app/data/service-account.json` | Внутрішній шлях до файлу авторизації Google API. |