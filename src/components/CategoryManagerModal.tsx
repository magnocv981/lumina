import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Category } from '../types/library';

interface CategoryManagerModalProps {
  isOpen: boolean;
  editingCategory: Category | null;
  onClose: () => void;
  onSave: (name: string, color: string, description?: string) => Promise<void>;
  onDelete?: (categoryId: string) => Promise<void>;
}

const COLOR_SWATCHES = [
  '#3B5BDB',
  '#0D9488',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0284C7',
  '#475569',
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  editingCategory,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setColor(editingCategory.color);
      setDescription(editingCategory.description || '');
    } else {
      setName('');
      setColor(COLOR_SWATCHES[0]);
      setDescription('');
    }
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), color, description.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141923] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-display">
            {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Nome da categoria
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Filosofia, Ficção Científica, Direito"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Cor identificadora
            </label>
            <div className="flex items-center gap-2.5 pt-1">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Cor ${swatch}`}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                    color === swatch ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-[#141923] scale-110' : ''
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Descrição opcional
            </label>
            <textarea
              rows={2}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição para organizar sua biblioteca no Windows."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingCategory && onDelete ? (
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  await onDelete(editingCategory.id);
                  setSaving(false);
                  onClose();
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-xl bg-[#3B5BDB] hover:bg-[#364FC7] disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
