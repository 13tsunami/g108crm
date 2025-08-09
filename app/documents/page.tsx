// app/documents/page.tsx
"use client";

interface DocumentItem {
  id: number;
  name: string;
  uploader: string;
  uploadedAt: string; // YYYY-MM-DD
  size: string;       // например "1.2 МБ"
  url: string;
}

export default function DocumentsPage() {
  // Пример данных; позднее будем подгружать из API
  const docs: DocumentItem[] = [
    {
      id: 1,
      name: "Положение о профориентации.pdf",
      uploader: "Канинов А.А.",
      uploadedAt: "2025-05-10",
      size: "1.2 МБ",
      url: "/files/Положение_профориентации.pdf",
    },
    {
      id: 2,
      name: "Шаблон анкеты.xlsx",
      uploader: "Сенатор В.А.",
      uploadedAt: "2025-05-12",
      size: "230 КБ",
      url: "/files/Шаблон_анкеты.xlsx",
    },
  ];

  return (
    <section className="space-y-6" id="documents">
      <h2 className="text-2xl font-semibold">📁 Репозиторий документов</h2>

      <button className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition">
        Загрузить новый документ
      </button>

      <div className="glass card relief p-6 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-accent/10 text-accent">
              <th className="p-3">Название</th>
              <th className="p-3">Загрузил</th>
              <th className="p-3">Дата загрузки</th>
              <th className="p-3">Размер</th>
              <th className="p-3">Действие</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, idx) => (
              <tr
                key={doc.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-white/80"}
              >
                <td className="p-3">{doc.name}</td>
                <td className="p-3">{doc.uploader}</td>
                <td className="p-3">{doc.uploadedAt}</td>
                <td className="p-3">{doc.size}</td>
                <td className="p-3">
                  <a
                    href={doc.url}
                    download
                    className="px-3 py-1 bg-accent text-white rounded hover:bg-accent/90 transition"
                  >
                    Скачать
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
