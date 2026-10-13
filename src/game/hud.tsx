import { useEffect, useRef, useSyncExternalStore } from "react";
import { ITEMS, QUESTS, RECIPES, SHOP, SKILLS, TRAVEL, DIALOGUES, itemDef } from "./content";
import { xpToNext } from "./logic";
import type { GameSim } from "./sim";
import { hasSave } from "./save";
import { KINGDOMS } from "./world";

export function Hud({ sim }: { sim: GameSim }) {
  const ver = useSyncExternalStore(sim.subscribe, sim.getVersion, sim.getVersion);
  void ver;
  const lang = sim.lang();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const showTouch = sim.settings.touch || (typeof window !== "undefined" && window.innerWidth < 860);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-moon" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="vignette pointer-events-none absolute inset-0" />
      {sim.phase === "play" || sim.phase === "dead" || sim.phase === "ending" ? <PlayChrome sim={sim} t={t} showTouch={showTouch} /> : null}
      {sim.phase === "title" ? <Title sim={sim} t={t} /> : null}
      {sim.phase === "cinematic" ? <Cinema sim={sim} t={t} /> : null}
      {sim.phase === "dead" ? <Dead sim={sim} t={t} /> : null}
      {sim.phase === "ending" ? <Ending sim={sim} t={t} /> : null}
      {sim.dialogue ? <Dialogue sim={sim} t={t} /> : null}
      {sim.note ? <Note sim={sim} t={t} /> : null}
      {sim.panel !== "none" ? <Panels sim={sim} t={t} /> : null}
      <Toasts sim={sim} t={t} />
      {showTouch && sim.phase === "play" && sim.panel === "none" && !sim.dialogue && !sim.note && !sim.endingOffer ? <Touch sim={sim} t={t} /> : null}
    </div>
  );
}

function Title({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const saved = hasSave();
  return (
    <div className="title-scrim absolute inset-0 flex flex-col justify-end p-6 pb-10 md:p-12">
      <p className="text-sand font-sans text-sm tracking-widest">{t("عالم مفتوح", "Open world")}</p>
      <h1 className="font-display text-5xl leading-tight text-moon md:text-7xl">{t("ممالك الشفق", "Kingdoms of Twilight")}</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-mist">
        {t("القمر انشقّ. ستّ بلّورات سقطت. وأنت استيقظت أمام مدينة لا تغنّي.", "The moon has split. Six crystals fell. You woke before a city that no longer sings.")}
      </p>
      <div className="mt-6 flex max-w-md flex-col gap-3">
        <button className="pointer-events-auto min-h-12 rounded-2xl bg-sand px-5 py-3 font-sans text-lg font-bold text-ink" onClick={() => sim.newGame()}>
          {t("مغامرة جديدة", "New game")}
        </button>
        <button className="pointer-events-auto min-h-12 rounded-2xl border border-line bg-dusk/80 px-5 py-3 text-lg text-moon disabled:opacity-40" disabled={!saved} onClick={() => sim.continueGame()}>
          {t("متابعة", "Continue")}
        </button>
        <button className="pointer-events-auto min-h-12 rounded-2xl border border-line px-5 py-3 text-moon" onClick={() => { sim.panel = "settings"; sim.poke(true); }}>
          {t("الإعدادات", "Settings")}
        </button>
      </div>
      <p className="mt-4 text-sm text-mist">
        {t("WASD حركة · اسحب الفأرة للكاميرا · نقرة للهجوم · J هجوم · C مراوغة · F صد · E تفاعل", "WASD move · drag mouse to look · click to attack · J attack · C dodge · F parry · E interact")}
      </p>
    </div>
  );
}

function Cinema({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-6 pb-10">
      <p className="max-w-2xl text-center font-display text-2xl leading-relaxed text-moon md:text-3xl">{sim.lang() === "ar" ? sim.line : sim.lineEn}</p>
      <button className="pointer-events-auto min-h-11 rounded-full border border-sand/50 px-5 text-sand" onClick={() => sim.skipCinematic()}>
        {t("تخطّي", "Skip")}
      </button>
    </div>
  );
}

function PlayChrome({ sim, t, showTouch }: { sim: GameSim; t: (a: string, b: string) => string; showTouch: boolean }) {
  const p = sim.player;
  const quest = sim.activeQuestText();
  const hp = Math.max(0, p.hp / p.maxHp);
  const en = p.energy / p.maxEnergy;
  return (
    <>
      <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-3 md:right-6 md:left-6">
        <div className="pointer-events-auto w-56 max-w-[46vw]">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{t("ساري", "Sari")}</span>
            <span dir="ltr">{sim.level}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-dusk">
            <div className="h-full bg-copper" style={{ width: `${hp * 100}%` }} />
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-dusk">
            <div className="h-full bg-sand" style={{ width: `${en * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-mist" dir="ltr">
            {Math.ceil(p.hp)} / {p.maxHp} · {t("شظايا", "motes")} {sim.motes}
            {sim.crystalCount() > 0 ? ` · ${t("بلّورات", "crystals")} ${sim.crystalCount()}/5` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Mini sim={sim} />
          <button className="pointer-events-auto min-h-11 min-w-11 rounded-full border border-line bg-dusk/80 text-sm" onClick={() => { sim.panel = "pause"; sim.poke(true); }}>
            {t("إيقاف", "Pause")}
          </button>
        </div>
      </div>
      {quest ? (
        <div className="absolute top-24 right-4 max-w-xs rounded-2xl border border-line bg-dusk/75 px-4 py-3 md:right-6">
          <p className="text-xs text-sand">{t("المهمة", "Quest")}</p>
          <p className="font-bold">{quest.title}</p>
          <p className="text-sm text-mist">{quest.obj}</p>
        </div>
      ) : null}
      {sim.hintAr ? (
        <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-dusk/80 px-4 py-2 text-sm ${showTouch ? "bottom-44" : "bottom-28"}`}>
          {sim.lang() === "ar" ? sim.hintAr : sim.hintEn}
        </div>
      ) : null}
      <p className="absolute bottom-3 left-3 text-xs text-mist" dir="ltr">{Math.round(sim.fps)} fps</p>
      {sim.endingOffer && sim.phase === "play" ? (
        <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center p-4" data-ui>
          <div className="pointer-events-auto max-w-lg rounded-3xl border border-sand/50 bg-ink/90 p-5">
            <p className="font-display text-2xl">{t("مصير القمر", "The moon's fate")}</p>
            <p className="mt-2 text-sm text-mist">{t("اختم الشقّ وتسكت القدرات، أو تترك القوة تمشي بين الناس.", "Seal the split and silence the arts, or let the power walk among people.")}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button className="min-h-12 rounded-xl bg-sand text-ink" onClick={() => sim.chooseEnding("seal")}>{t("أختم القمر", "Seal the moon")}</button>
              <button className="min-h-12 rounded-xl border border-line" onClick={() => sim.chooseEnding("share")}>{t("أشطر القوة", "Share the power")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Mini({ sim }: { sim: GameSim }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const w = c.width;
    const h = c.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#1c1612";
    g.fillRect(0, 0, w, h);
    const map = (x: number, z: number) => [((x + 340) / 680) * w, ((z + 340) / 680) * h] as const;
    for (const k of KINGDOMS) {
      const [x, y] = map(k.x, k.z);
      g.fillStyle = sim.discovered.has(k.id) ? k.color : "#3c332b";
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
    }
    const [px, py] = map(sim.player.x, sim.player.z);
    g.fillStyle = "#f3efe4";
    g.fillRect(px - 2, py - 2, 4, 4);
  });
  return <canvas ref={ref} width={88} height={88} className="rounded-xl border border-line" />;
}

function Dialogue({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const d = sim.dialogue;
  if (!d) return null;
  const node = DIALOGUES[d.npc]?.[d.node];
  if (!node) return null;
  const npc = sim.npcSpots().find((n) => n.id === d.npc);
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 md:p-8" data-ui>
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-3xl border border-line bg-ink/90 p-5">
        <p className="text-sand">{npc ? t(npc.ar, npc.en) : ""}</p>
        <p className="mt-2 text-lg leading-relaxed">{t(node.ar, node.en)}</p>
        <div className="mt-4 flex flex-col gap-2">
          {node.choices.map((c, i) => (
            <button key={i} className="min-h-11 rounded-xl border border-line px-4 py-2 text-start hover:border-sand" onClick={() => sim.choose(i)}>
              {t(c.ar, c.en)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Note({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  if (!sim.note) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" data-ui>
      <div className="pointer-events-auto max-w-lg rounded-3xl border border-sand/40 bg-ink/92 p-6">
        <p className="font-display text-2xl leading-relaxed">{t(sim.note.ar, sim.note.en)}</p>
        <button className="mt-4 min-h-11 rounded-xl bg-sand px-4 text-ink" onClick={() => sim.closeNote()}>{t("إغلاق", "Close")}</button>
      </div>
    </div>
  );
}

function Panels({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/55 p-4" data-ui>
      <div className="pointer-events-auto max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-dusk p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl">
            {sim.panel === "pause" ? t("توقّف", "Paused") : null}
            {sim.panel === "map" ? t("الخريطة", "Map") : null}
            {sim.panel === "inv" ? t("الحقيبة", "Inventory") : null}
            {sim.panel === "skills" ? t("المهارات", "Skills") : null}
            {sim.panel === "quests" ? t("المهمات", "Quests") : null}
            {sim.panel === "shop" ? t("دكّان صخر", "Sakhr's Stall") : null}
            {sim.panel === "craft" ? t("الصناعة", "Crafting") : null}
            {sim.panel === "settings" ? t("الإعدادات", "Settings") : null}
          </h2>
          <button className="min-h-11 rounded-xl border border-line px-3" onClick={() => sim.closePanel()}>{t("إغلاق", "Close")}</button>
        </div>
        {sim.panel === "pause" ? <PauseBody sim={sim} t={t} /> : null}
        {sim.panel === "settings" ? <SettingsBody sim={sim} t={t} /> : null}
        {sim.panel === "map" ? <MapBody sim={sim} t={t} /> : null}
        {sim.panel === "inv" ? <InvBody sim={sim} t={t} /> : null}
        {sim.panel === "skills" ? <SkillBody sim={sim} t={t} /> : null}
        {sim.panel === "quests" ? <QuestBody sim={sim} t={t} /> : null}
        {sim.panel === "shop" ? <ShopBody sim={sim} t={t} /> : null}
        {sim.panel === "craft" ? <CraftBody sim={sim} t={t} /> : null}
      </div>
    </div>
  );
}

function PauseBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const btn = "min-h-11 rounded-xl border border-line px-4 py-2 text-start";
  return (
    <div className="flex flex-col gap-2">
      <button className={btn} onClick={() => sim.closePanel()}>{t("عودة", "Resume")}</button>
      <button className={btn} onClick={() => { sim.panel = "map"; sim.poke(true); }}>{t("الخريطة والسفر", "Map and travel")}</button>
      <button className={btn} onClick={() => { sim.panel = "quests"; sim.poke(true); }}>{t("المهمات", "Quests")}</button>
      <button className={btn} onClick={() => { sim.panel = "inv"; sim.poke(true); }}>{t("الحقيبة", "Inventory")}</button>
      <button className={btn} onClick={() => { sim.panel = "skills"; sim.poke(true); }}>{t("المهارات", "Skills")}</button>
      <button className={btn} onClick={() => sim.save()}>{t("حفظ", "Save")}</button>
      <button className={btn} onClick={() => { sim.panel = "settings"; sim.poke(true); }}>{t("الإعدادات", "Settings")}</button>
      <button className={btn} onClick={() => { sim.phase = "title"; sim.panel = "none"; sim.poke(true); }}>{t("القائمة", "Title")}</button>
      <p className="mt-2 text-sm text-mist">{t("المستوى", "Level")} {sim.level} · {t("قتلى", "Foes")} {sim.kills} · {t("صدّ", "Parries")} {sim.parries}</p>
    </div>
  );
}

function SettingsBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const s = sim.settings;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex gap-2">
        <button className={`min-h-11 flex-1 rounded-xl ${s.lang === "ar" ? "bg-sand text-ink" : "border border-line"}`} onClick={() => sim.setLang("ar")}>العربية</button>
        <button className={`min-h-11 flex-1 rounded-xl ${s.lang === "en" ? "bg-sand text-ink" : "border border-line"}`} onClick={() => sim.setLang("en")}>English</button>
      </div>
      <p>{t("الجودة", "Quality")}</p>
      <div className="flex gap-2">
        {(["low", "med", "high"] as const).map((q) => (
          <button key={q} className={`min-h-11 flex-1 rounded-xl border ${s.quality === q ? "border-sand text-sand" : "border-line"}`} onClick={() => { s.quality = q; sim.saveSettings(); }}>
            {q === "low" ? t("منخفضة", "Low") : q === "med" ? t("متوسطة", "Medium") : t("عالية", "High")}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1">{t("الموسيقى", "Music")}<input className="pointer-events-auto" type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => { s.music = Number(e.target.value); sim.saveSettings(); }} /></label>
      <label className="flex flex-col gap-1">{t("المؤثرات", "Effects")}<input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => { s.sfx = Number(e.target.value); sim.saveSettings(); }} /></label>
      <label className="flex flex-col gap-1">{t("حساسية الكاميرا", "Camera sensitivity")}<input type="range" min={0.001} max={0.006} step={0.0002} value={s.sens} onChange={(e) => { s.sens = Number(e.target.value); sim.saveSettings(); }} /></label>
      <button className="min-h-11 rounded-xl border border-line" onClick={() => { s.touch = !s.touch; sim.saveSettings(); }}>
        {t("أزرار اللمس", "Touch buttons")}: {s.touch ? t("ظاهرة", "On") : t("مخفية", "Off")}
      </button>
      <p className="text-mist">{t("الجودة المنخفضة أخف، والعالية تُظهر الظلال.", "Low is lighter. High turns shadows on.")}</p>
    </div>
  );
}

function MapBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      {TRAVEL.map((spot) => {
        const known = sim.discovered.has(spot.id);
        return (
          <button key={spot.id} disabled={!known || sim.phase !== "play"} className="min-h-11 rounded-xl border border-line px-3 text-start disabled:opacity-40" onClick={() => sim.travelTo(spot.id)}>
            {t(spot.ar, spot.en)} {known ? "" : t("— لم تُكتشف", "— unknown")}
          </button>
        );
      })}
      <p className="text-sm text-mist">{t("السفر يعمل بعد زيارة المسلة في كل مملكة.", "Travel unlocks once you have walked each kingdom.")}</p>
    </div>
  );
}

function InvBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const ids = Object.keys(sim.inv).filter((id) => (sim.inv[id] ?? 0) > 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-mist">{t("السلاح", "Weapon")}: {t(itemDef(sim.weapon).ar, itemDef(sim.weapon).en)} · {t("الدرع", "Armor")}: {t(itemDef(sim.armor).ar, itemDef(sim.armor).en)}</p>
      {ids.map((id) => {
        const it = ITEMS.find((x) => x.id === id) ?? itemDef(id);
        return (
          <button key={id} className="min-h-11 rounded-xl border border-line px-3 text-start" onClick={() => sim.equip(id)}>
            <span className="font-bold">{t(it.ar, it.en)}</span>
            <span className="text-mist" dir="ltr"> ×{sim.inv[id]}</span>
            <span className="block text-xs text-mist">{t(it.arDesc, it.enDesc)}</span>
          </button>
        );
      })}
    </div>
  );
}

function SkillBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      <p>{t("نقاط", "Points")} {sim.points} · {t("خبرة", "XP")} {sim.xp}/{xpToNext(sim.level)}</p>
      {SKILLS.map((sk) => (
        <button key={sk.id} className="min-h-11 rounded-xl border border-line px-3 text-start" onClick={() => sim.buySkill(sk.id)}>
          {t(sk.ar, sk.en)} ({sim.skills[sk.id] ?? 0}/{sk.max})
          <span className="block text-xs text-mist">{t(sk.arDesc, sk.enDesc)}</span>
        </button>
      ))}
    </div>
  );
}

function QuestBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const list = QUESTS.filter((q) => sim.quests[q.id]?.status !== "locked");
  return (
    <div className="flex flex-col gap-3">
      {list.map((q) => {
        const st = sim.quests[q.id];
        const obj = q.objectives[st?.step ?? 0];
        return (
          <div key={q.id} className="rounded-2xl border border-line p-3">
            <p className="text-xs text-sand">{q.kind === "main" ? t("رئيسية", "Main") : q.kind === "secret" ? t("سرّ", "Secret") : t("جانبية", "Side")}</p>
            <p className="font-bold">{t(q.ar, q.en)}</p>
            <p className="text-sm text-mist">{st?.status === "done" ? t("أُنجزت", "Complete") : obj ? t(obj.ar, obj.en) : t(q.arSum, q.enSum)}</p>
          </div>
        );
      })}
    </div>
  );
}

function ShopBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sand">{t("شظايا", "Motes")} {sim.motes}</p>
      {SHOP.map((s) => {
        const it = itemDef(s.item);
        return (
          <button key={s.item} className="min-h-11 rounded-xl border border-line px-3 text-start" onClick={() => sim.buy(s.item)}>
            {t(it.ar, it.en)} · {s.price}
          </button>
        );
      })}
    </div>
  );
}

function CraftBody({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      {RECIPES.map((r) => (
        <button key={r.id} className="min-h-11 rounded-xl border border-line px-3 text-start" onClick={() => sim.craft(r.id)}>
          {t(r.ar, r.en)}
          <span className="block text-xs text-mist">{Object.entries(r.inputs).map(([k, n]) => `${t(itemDef(k).ar, itemDef(k).en)} ${n}`).join(" · ")}</span>
        </button>
      ))}
    </div>
  );
}

function Dead({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
      <p className="font-display text-4xl">{t("سقطت… والرمال تعيدك", "You fell… the sand takes you back")}</p>
    </div>
  );
}

function Ending({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  const seal = sim.ending === "seal";
  return (
    <div className="absolute inset-0 flex items-end end-scrim p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-12">
      <div className="max-w-2xl">
        <p className="text-sand">{t("النهاية", "Ending")}</p>
        <h2 className="font-display text-4xl md:text-6xl">{seal ? t("ختم القمر", "The Moon Sealed") : t("شفق مشترك", "A Shared Twilight")}</h2>
        <p className="mt-3 text-lg leading-relaxed text-mist">
          {seal
            ? t("أقفلت الشقّ بيدك. سكتت القدرات، وعاد الليل واحدًا. المدينة ستتعلّم الغناء من جديد، أبطأ.", "You closed the split with your hand. The arts went quiet, and night became one again. The city will learn to sing once more, slower.")
            : t("تركت القوة تمشي بين الناس. بقي في السماء أثر كجرحٍ جميل، وأنت ما زلت تحمل غبارًا دافئًا.", "You let the power walk among people. A beautiful wound remains in the sky, and you still carry warm dust.")}
        </p>
        <p className="mt-3 text-sm text-mist" dir="ltr">{t("مستوى", "Lv")} {sim.level} · {sim.kills} · {Math.round(sim.play)}s</p>
        <button className="pointer-events-auto mt-4 min-h-12 rounded-2xl bg-sand px-5 text-ink" onClick={() => { sim.phase = "title"; sim.poke(true); }}>{t("إلى البداية", "Title")}</button>
      </div>
    </div>
  );
}

function Toasts({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="absolute top-36 left-1/2 flex w-72 -translate-x-1/2 flex-col gap-2">
      {sim.toasts.map((toast, i) => (
        <div key={i} className="rounded-full bg-dusk/85 px-4 py-2 text-center text-sm">{t(toast.ar, toast.en)}</div>
      ))}
    </div>
  );
}

function Touch({ sim, t }: { sim: GameSim; t: (a: string, b: string) => string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <StickZone sim={sim} />
      <LookZone sim={sim} />
      <div className="pointer-events-auto absolute right-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))] grid grid-cols-3 gap-2">
        <TouchBtn label={t("قفز", "Jump")} onPress={() => { sim.holdJump = true; sim.tap("jump"); }} onRelease={() => { sim.holdJump = false; }} />
        <TouchBtn label={t("هجوم", "Atk")} onPress={() => sim.tap("attack")} />
        <TouchBtn label={t("ثقيل", "Heavy")} onPress={() => sim.tap("heavy")} />
        <TouchBtn label={t("مراوغة", "Dodge")} onPress={() => sim.tap("dodge")} />
        <TouchBtn label={t("صد", "Parry")} onPress={() => sim.tap("parry")} />
        <TouchBtn label={t("تفاعل", "Use")} onPress={() => sim.tap("interact")} />
        <TouchBtn label={t("رمل", "Sand")} onPress={() => sim.tap("sand")} />
        <TouchBtn label={t("برق", "Bolt")} onPress={() => sim.tap("bolt")} />
        <TouchBtn label={t("ريح", "Wind")} onPress={() => sim.tap("wind")} />
      </div>
    </div>
  );
}

function TouchBtn({ label, onPress, onRelease }: { label: string; onPress: () => void; onRelease?: () => void }) {
  return (
    <button
      className="min-h-12 min-w-12 rounded-2xl border border-line bg-dusk/70 px-2 text-xs"
      onPointerDown={(e) => { e.stopPropagation(); onPress(); }}
      onPointerUp={() => onRelease?.()}
      onPointerLeave={() => onRelease?.()}
    >
      {label}
    </button>
  );
}

function StickZone({ sim }: { sim: GameSim }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: number | null = null;
    let ox = 0;
    let oy = 0;
    const start = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      const x = Math.max(-1, Math.min(1, (e.clientX - ox) / 48));
      const y = Math.max(-1, Math.min(1, -(e.clientY - oy) / 48));
      sim.stick.x = x;
      sim.stick.y = y;
    };
    const end = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      id = null;
      sim.stick.x = 0;
      sim.stick.y = 0;
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
  }, [sim]);
  return <div ref={ref} className="pointer-events-auto absolute bottom-0 left-0 h-[46%] w-[42%]" />;
}

function LookZone({ sim }: { sim: GameSim }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: number | null = null;
    let lx = 0;
    let ly = 0;
    const start = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      id = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      sim.addLook((e.clientX - lx) * 0.85, (e.clientY - ly) * 0.7);
      lx = e.clientX;
      ly = e.clientY;
    };
    const end = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      id = null;
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
  }, [sim]);
  return <div ref={ref} className="pointer-events-auto absolute top-28 right-0 bottom-0 w-[58%]" />;
}
