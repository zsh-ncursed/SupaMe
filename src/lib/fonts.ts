// Загрузка шрифтов: все с поддержкой кириллицы (кроме Anton — только латиница, для мемов на английском)
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/700.css';
import '@fontsource/roboto-condensed/400.css';
import '@fontsource/roboto-condensed/700.css';
import '@fontsource/marck-script/400.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/anton/400.css';

export interface FontDef {
  family: string;
  label: string;
}

export const FONTS: FontDef[] = [
  { family: 'Anton', label: 'Anton (мемный, латиница)' },
  { family: 'Oswald', label: 'Oswald' },
  { family: 'Roboto Condensed', label: 'Roboto Condensed' },
  { family: 'Inter', label: 'Inter' },
  { family: 'Marck Script', label: 'Marck Script (рукописный)' },
  { family: 'JetBrains Mono', label: 'JetBrains Mono (моно)' },
];

export const DEFAULT_FONT = 'Oswald';
export const CAPTION_FONT = 'Oswald'; // аналог Impact для подписей
export const BUBBLE_FONT = 'Marck Script';
