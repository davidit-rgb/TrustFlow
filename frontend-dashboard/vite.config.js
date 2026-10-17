import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react' (mantén tus plugins arriba)

export default defineConfig({
  // plugins: [react()], (mantén la línea de tus plugins y asegúrate de que termine en coma)
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true
  }
})