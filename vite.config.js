import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // (or vue, vanilla, etc.)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/SwarmDB-Demo/',  // 👈 ADD THIS EXACT LINE WITH YOUR REPO NAME
})
