'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setReminders } from '@/lib/api/tasks';

interface Props {
  taskId: string;
  initialOffsets: number[];
}

export function RemindersConfig({ taskId, initialOffsets }: Props) {
  const [offsets, setOffsets] = useState<number[]>(initialOffsets);
  const [newOffset, setNewOffset] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function addOffset() {
    const val = parseInt(newOffset, 10);
    if (isNaN(val) || val < 1 || val > 10080) return;
    if (offsets.includes(val)) {
      setNewOffset('');
      return;
    }
    setOffsets((prev) => [...prev, val].sort((a, b) => a - b));
    setNewOffset('');
  }

  function removeOffset(offset: number) {
    setOffsets((prev) => prev.filter((o) => o !== offset));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await setReminders(taskId, offsets);
      toast.success('Rappels enregistrés.');
    } catch {
      toast.error('Erreur lors de la sauvegarde des rappels.');
    } finally {
      setIsSaving(false);
    }
  }

  function formatOffset(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} j`;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Mes rappels
      </p>
      <p className="text-xs text-text-secondary">
        Rappels avant l&apos;échéance (max 10 entrées, 1 min – 1 semaine)
      </p>

      <div className="flex flex-wrap gap-2">
        {offsets.map((o) => (
          <span
            key={o}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light text-accent text-xs font-medium"
          >
            {formatOffset(o)}
            <button
              onClick={() => removeOffset(o)}
              aria-label={`Supprimer rappel ${formatOffset(o)}`}
              className="hover:text-accent/70"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {offsets.length < 10 && (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="Minutes avant l'échéance"
            value={newOffset}
            min={1}
            max={10080}
            className="w-48"
            onChange={(e) => setNewOffset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOffset()}
          />
          <Button variant="outline" size="sm" onClick={addOffset} type="button">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={isSaving}>
        Enregistrer les rappels
      </Button>
    </div>
  );
}
