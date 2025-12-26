import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLoginMutation } from "../services/api";
import { useAppDispatch } from "../app/hooks";
import { setUser } from "../app/authSlice";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login, { isLoading, error }] = useLoginMutation();
  const [form, setForm] = useState({ email: "", password: "" });

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    const user = await login(form).unwrap();
    dispatch(setUser(user));
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">
            {t("users.login")}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeLanguage("en")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                i18n.language === "en"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage("zh")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                i18n.language === "zh"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              中文
            </button>
          </div>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <input
            type="email"
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("users.emailPlaceholder")}
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <input
            type="password"
            className="rounded-lg border border-slate-200 px-3 py-2"
            placeholder={t("users.password")}
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
          {error && (
            <div className="text-sm text-rose-600">
              {t("users.invalidCredentials")}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading ? t("common.saving") : t("users.login")}
          </button>
        </form>
      </div>
    </div>
  );
}

