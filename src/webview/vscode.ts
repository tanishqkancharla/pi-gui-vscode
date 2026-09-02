type VsCodeApi = {
  postMessage(message: unknown): void;
};

const api: VsCodeApi =
  typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi()
    : {
        postMessage(message: unknown) {
          window.parent.postMessage(message, "*");
        },
      };

export const vscode = api;

declare function acquireVsCodeApi(): VsCodeApi;
