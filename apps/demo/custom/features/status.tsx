import { defineFeature, page } from "@consify/core";
import { Link } from "react-router";

// A real site would read these from an API or a file of `content/`.
const services = [
  { id: "scheduler", name: "Scheduler", state: "operational" },
  { id: "workers", name: "Workers", state: "operational" },
  { id: "dashboard", name: "Dashboard", state: "degraded" },
] as const;

/** A status page: a list, a page per service and a JSON file, in every language of the site. */
export const status = defineFeature({
  id: "status",
  title: ({ t }) => t("status"),
  description: ({ t }) => t("hint"),
  messages: {
    en: {
      status: "Status",
      hint: "Live state of the services",
      operational: "Operational",
      degraded: "Degraded",
      back: "All services",
    },
    ru: {
      status: "Статус",
      hint: "Состояние сервисов сейчас",
      operational: "Работает",
      degraded: "Сбои",
      back: "Все сервисы",
    },
  },
  pages: {
    "/": ({ lang, t }) => (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="mb-8 text-3xl font-semibold">{t("status")}</h1>
        <ul className="divide-y divide-fd-border rounded-lg border border-fd-border">
          {services.map((service) => (
            <li key={service.id}>
              <Link
                to={`/${lang}/status/${service.id}`}
                className="flex justify-between px-4 py-3 hover:bg-fd-accent"
              >
                <span>{service.name}</span>
                <span className="text-sm text-fd-muted-foreground">{t(service.state)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    ),
    "/:service": page({
      paths: () => services.map((service) => ({ service: service.id })),
      load: ({ params, notFound }) =>
        services.find((service) => service.id === params.service) ?? notFound(),
      title: ({ data }) => data.name,
      component: ({ data, lang, t }) => (
        <main className="mx-auto w-full max-w-2xl px-4 py-12">
          <Link to={`/${lang}/status`} className="text-sm text-fd-muted-foreground">
            ← {t("back")}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">{data.name}</h1>
          <p className="mt-2 text-fd-muted-foreground">{t(data.state)}</p>
        </main>
      ),
    }),
  },
  files: {
    "/status.json": () => ({ services }),
  },
});
