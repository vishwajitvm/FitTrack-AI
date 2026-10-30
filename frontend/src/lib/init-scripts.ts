// Inline <head> scripts that apply saved display preferences before first paint (no flash).
// Kept in a plain (non-"use client") module: the server layout must receive real strings,
// not client references.

export const THEME_STORAGE_KEY = "fittrack.theme";
export const TEXT_SIZE_KEY = "fittrack.textSize";

const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((t!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

const textSizeInitScript = `(function(){try{if(localStorage.getItem("${TEXT_SIZE_KEY}")==="large")document.documentElement.style.fontSize="112.5%";}catch(e){}})();`;

export const displayInitScript = themeInitScript + textSizeInitScript;
