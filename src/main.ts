import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSudokuStore, persistSudoku } from './stores/sudoku'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const store = useSudokuStore(pinia)
store.hydrate()
persistSudoku(store)
app.mount('#app')
