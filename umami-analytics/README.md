# Limitless, Free Self-Hosted Umami Analytics (MySQL Version)

This setup allows you to run your own private, open-source analytics server to track website visits limitlessly using **MySQL** as the database.

---

## Option 1: Use your own Existing MySQL Server (Shared Database)
If you want to use the same MySQL instance that your main platform is using:
1. Log into your MySQL console and create a new database for Umami:
   ```sql
   CREATE DATABASE umami_db;
   ```
2. When deploying Umami (e.g. on Vercel or a standalone Docker container), set the database connection environment variable:
   ```env
   DATABASE_URL=mysql://<username>:<password>@<mysql-host>:<port>/umami_db
   APP_SECRET=some_random_secret_string
   ```
3. Get the script code from your custom Umami dashboard and paste it inside the `<head>` of your website's `frontend/index.html`.

---

## Option 2: Deploy on your Server via Docker Compose (Separate Container)
If you want a separate, dedicated MySQL instance just for analytics (to keep it isolated from application data):
1. Navigate to this directory (`umami-analytics`) on your server.
2. Start the services:
   ```bash
   docker-compose up -d
   ```
3. Open your browser and go to `http://<your-server-ip>:3000`.
4. Log in using default admin credentials:
   * **Username**: `admin`
   * **Password**: `umami`
5. Change the password immediately in the settings panel.
6. Create a website inside Umami, copy the script tag, and paste it inside the `<head>` of your website's `frontend/index.html`.
