/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * jira-clone: seletor de arquivos do Google Drive.
 *
 * Abre o Google Drive Picker (docs: developers.google.com/drive/picker)
 * e devolve o arquivo selecionado para ser anexado como link na task.
 *
 * Requer duas variaveis de ambiente no build do web:
 *   VITE_GOOGLE_DRIVE_API_KEY
 *   VITE_GOOGLE_DRIVE_APP_ID   (project number do app no Google Cloud)
 *
 * Sem essas chaves, o seletor fica inativo.
 */

export type TDriveFile = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  iconUrl?: string;
};

export type TDrivePickerConfig = {
  apiKey: string;
  appId: string;
};

// Usa um namespace proprio para nao colidir com os tipos globais do Google
// que ja existem no projeto (window.google: Google).
type DrivePickerApi = {
  PickerBuilder: new () => DrivePickerBuilder;
  ViewId: { DOCS: string };
  Action: { CANCEL: string; PICKED: string };
};

type DrivePickerBuilder = {
  addView: (view: string) => DrivePickerBuilder;
  setOAuthToken: (token: string) => DrivePickerBuilder;
  setDeveloperKey: (key: string) => DrivePickerBuilder;
  setAppId: (id: string) => DrivePickerBuilder;
  setCallback: (cb: (data: any) => void) => DrivePickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};

type DrivePickerWindow = Window & {
  __drivePickerGoogle?: { picker: DrivePickerApi };
  gapi?: { load: (mods: string, cb: () => void) => void };
};

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

let carregando: Promise<void> | null = null;

/** Carrega o script da API do Google (gapi + picker) uma unica vez. */
export function carregarGoogleDriveApi(): Promise<void> {
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const w = window as DrivePickerWindow;
    if (w.__drivePickerGoogle?.picker && w.gapi) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.addEventListener("load", () => {
      w.gapi?.load("picker", () => {
        // O google.picker fica em window.google; guardamos uma referencia
        // propria para nao conflitar com os tipos globais existentes.
        w.__drivePickerGoogle = { picker: (window as any).google?.picker };
        resolve();
      });
    });
    script.addEventListener("error", () => reject(new Error("Falha ao carregar API do Google")));
    document.head.appendChild(script);
  });
  return carregando;
}

/** Abre o Picker e resolve com o arquivo escolhido, ou null se cancelado. */
export async function abrirDrivePicker(config: TDrivePickerConfig, token: string): Promise<TDriveFile | null> {
  await carregarGoogleDriveApi();
  const w = window as DrivePickerWindow;
  const pickerApi = w.__drivePickerGoogle?.picker;
  if (!pickerApi) throw new Error("Google Drive Picker indisponivel");

  return new Promise((resolve, reject) => {
    try {
      const picker = new pickerApi.PickerBuilder()
        .addView(pickerApi.ViewId.DOCS)
        .setOAuthToken(token)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .setCallback((data: any) => {
          if (data.action === pickerApi.Action.CANCEL) {
            resolve(null);
            return;
          }
          if (data.action === pickerApi.Action.PICKED) {
            const doc = data.docs?.[0];
            if (!doc) {
              resolve(null);
              return;
            }
            resolve({
              id: doc.id,
              name: doc.name,
              url: doc.url || `https://drive.google.com/file/d/${doc.id}/view`,
              mimeType: doc.mimeType,
              iconUrl: doc.iconUrl,
            });
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
}

/** Configuracao vinda das variaveis de ambiente do build. */
export function driveConfig(): TDrivePickerConfig | null {
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  const appId = import.meta.env.VITE_GOOGLE_DRIVE_APP_ID;
  if (!apiKey || !appId) return null;
  return { apiKey, appId };
}

export { SCOPE };
