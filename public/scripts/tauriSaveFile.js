const { save } = window.__TAURI__.dialog;
const { writeBinaryFile } = window.__TAURI__.fs;

const tauriSaveFile = async (filename, blob) => {
  try {
    const path = await save({ defaultPath: filename });
    const contents = await blob.arrayBuffer();
    if (path && contents) {
      await writeBinaryFile({ path, contents });
    }
  } catch (err) {
    console.log(err);
  }
};
