import { useEditor } from '../store/editorStore';
import { useUi } from '../store/uiStore';

export function Welcome() {
  const hasProject = useEditor((s) => s.projectId !== null);
  const openProjects = useUi((s) => s.openProjects);
  if (hasProject) return null;

  return (
    <div className="welcome">
      <div className="welcome__card">
        <div className="welcome__logo">SupaMe</div>
        <div className="welcome__subtitle">Редактор мемов: изображения, текст, бабблы</div>
        <ul className="welcome__list">
          <li>Загрузите изображение или перетащите его на холст</li>
          <li>Добавьте текст, подпись сверху/снизу или комиксный баббл</li>
          <li>Экспортируйте мем в PNG, JPEG или WebP</li>
        </ul>
        <div className="welcome__actions">
          <button className="btn btn--primary btn--lg" onClick={() => useEditor.getState().newProject()}>
            Создать проект
          </button>
          <button className="btn btn--lg" onClick={openProjects}>
            Открыть проект
          </button>
        </div>
        <div className="welcome__note">Данные хранятся локально в вашем браузере</div>
      </div>
    </div>
  );
}
