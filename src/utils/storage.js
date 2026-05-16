export const Storage = {
  save: async (data) => {
    return await window.electronAPI.saveData(data);
  },
  load: async () => {
    return await window.electronAPI.loadData();
  }
};
