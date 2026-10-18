import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { CatalogPicker } from "./CatalogPicker";
import { ExtensionPage } from "./ExtensionPage";
import {
  addSkillSource,
  installSkill,
  listSkills,
  listSkillSources,
  loadSkillCatalog,
  removeSkillSource,
  SKILLS_CHANGED,
  uninstallSkill,
  type InstalledSkill,
  type SkillCatalogEntry,
} from "../../api";
import { t } from "../../i18n";

type Tab = "installed" | "market";

function announceChange() {
  window.dispatchEvent(new Event(SKILLS_CHANGED));
}

/// Skills: pastas com SKILL.md que o Claude Code e o Codex leem. Instalar grava nas duas CLIs,
/// e o menu `/` do composer passa a mostrar a skill.
export function SkillsSection() {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  /** Catálogo escolhido: "" é o oficial. */
  const [source, setSource] = useState("");
  const [catalog, setCatalog] = useState<SkillCatalogEntry[] | undefined>(undefined);
  const [deleting, setDeleting] = useState<InstalledSkill | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function reloadInstalled() {
    try {
      setInstalled(await listSkills());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reloadInstalled();
    listSkillSources()
      .then(setSources)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setCatalog(undefined);
    loadSkillCatalog(source || undefined)
      .then((c) => setCatalog(c.skills))
      .catch((e) => setError(String(e)));
  }, [source]);

  async function install(entry: SkillCatalogEntry) {
    setError(undefined);
    try {
      await installSkill(entry.id, source || undefined);
      setStatus(t("skills.installed", { name: entry.name }));
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(skill: InstalledSkill) {
    setError(undefined);
    try {
      await uninstallSkill(skill.id);
      setDeleting(undefined);
      setStatus(t("skills.deleted", { name: skill.name }));
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  async function addSource(url: string) {
    const urls = await addSkillSource(url);
    setSources(urls);
    setSource(url);
    setStatus(t("common.catalogAdded"));
  }

  async function removeSource(url: string) {
    try {
      setSources(await removeSkillSource(url));
      setStatus(t("common.catalogRemoved"));
    } catch (e) {
      setError(String(e));
    }
  }

  const installedIds = new Set(installed.map((s) => s.id));

  return (
    <ExtensionPage
      title="Skills"
      description={t("skills.description")}
      tabs={[
        { id: "installed", label: t("skills.tab.installed") },
        { id: "market", label: t("skills.tab.market") },
      ]}
      tab={tab}
      onTab={(id) => setTab(id as Tab)}
      status={status}
      error={error}
    >
      {tab === "installed" && (
        <>
          {installed.length === 0 && <p className="settings__hint">{t("skills.noneInstalled")}</p>}
          <ul className="settings-list">
            {installed.map((s) => (
              <li key={s.id} className="settings-card">
                <div className="settings-card__head">
                  <strong>{s.name}</strong>
                  <span className="settings-card__meta">
                    /{s.id} · {s.engines.join(t("common.and"))}
                  </span>
                </div>
                <p className="settings-card__text">{s.description}</p>
                <div className="settings-actions">
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleting(s)}>
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "market" && (
        <>
          <CatalogPicker
            sources={sources}
            value={source}
            onChange={setSource}
            onAdd={addSource}
            onRemove={removeSource}
          />
          {!catalog && <p className="settings__hint">{t("common.loadingCatalog")}</p>}
          {catalog && catalog.length === 0 && <p className="settings__hint">{t("skills.emptyCatalog")}</p>}
          <ul className="settings-list">
            {catalog?.map((c) => (
              <li key={c.id} className="settings-card">
                <div className="settings-card__head">
                  <strong>{c.name}</strong>
                  <span className="settings-card__meta">
                    v{c.version} · {c.author}
                  </span>
                </div>
                <p className="settings-card__text">{c.description}</p>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={installedIds.has(c.id)}
                    onClick={() => void install(c)}
                  >
                    {installedIds.has(c.id) ? t("common.installed") : t("common.install")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("skills.deleteTitle", { name: deleting.name })}
          body={t("skills.deleteBody")}
          confirmLabel={t("skills.deleteConfirm")}
          danger
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </ExtensionPage>
  );
}
