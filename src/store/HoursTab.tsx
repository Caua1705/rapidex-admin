import { useState } from 'react';

import { Switch } from '../ui/Switch';
import { validateWeek, WEEKDAYS } from './business-hours';
import { SaveBar } from './SaveBar';
import { useBusinessHours } from './useBusinessHours';

/**
 * A grade de horários da filial: sete linhas, uma por dia.
 *
 * O salvamento manda a SEMANA INTEIRA porque o PUT substitui tudo — dia que não
 * for no corpo vira dia fechado. Quem garante isso é `weekPayload`, e não esta
 * tela; aqui o que importa é que o botão salva a grade toda, e não a linha que
 * o lojista acabou de mexer. Um botão por linha seria a forma mais direta de
 * fechar a loja no resto da semana sem perceber.
 *
 * Faixa que vira a noite (18:00 às 02:00) é válida e não leva aviso: é o
 * horário normal de pizzaria.
 */
export function HoursTab({ branchId }: { branchId: string }) {
  const hours = useBusinessHours(branchId);
  const [problem, setProblem] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    const problems = validateWeek(hours.week);
    if (problems.length > 0) {
      const first = problems[0]!;
      const day = WEEKDAYS.find((weekday) => weekday.weekday === first.weekday);
      setProblem(`${day?.label ?? 'Dia'}: ${first.message}`);
      return;
    }

    setProblem(null);
    if (await hours.save()) setDirty(false);
  }

  if (hours.isLoading) return <p className="muted store__loading">Carregando os horários…</p>;

  return (
    <form
      className="store-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <section className="store-form__section">
        <h2 className="store-form__heading">Horário de funcionamento</h2>
        <p className="faint store-form__hint">
          Salvar grava a semana inteira: o que estiver marcado como fechado aqui fica fechado no
          app.
        </p>

        {/* A grade edita UMA faixa por dia. Se o backend tem duas (almoço e
            jantar), salvar por aqui apaga a segunda — dizer isso antes é mais
            barato que o lojista descobrir no dia seguinte. */}
        {hours.collapsedPeriods ? (
          <p className="alert alert--warn store-form__warn" data-testid="hours-collapsed">
            Esta filial tem mais de uma faixa em algum dia (por exemplo, almoço e jantar). Esta tela
            edita uma faixa por dia — salvar aqui mantém só a primeira.
          </p>
        ) : null}

        <ul className="hours">
          {WEEKDAYS.map(({ weekday, label }) => {
            const day = hours.week.find((candidate) => candidate.weekday === weekday);
            if (!day) return null;

            return (
              <li className="hours__row" key={weekday} data-testid={`hours-row-${weekday}`}>
                <span className="hours__day">{label}</span>

                <Switch
                  checked={!day.isClosed}
                  label={`${label}: ${day.isClosed ? 'abrir' : 'fechar'}`}
                  onChange={(next) => {
                    hours.updateDay(weekday, { isClosed: !next });
                    setDirty(true);
                    setProblem(null);
                  }}
                />

                <span className="hours__state faint">{day.isClosed ? 'Fechado' : 'Aberto'}</span>

                <input
                  className="input mono hours__time"
                  type="time"
                  aria-label={`${label}: abre às`}
                  value={day.opensAt}
                  disabled={day.isClosed}
                  onChange={(event) => {
                    hours.updateDay(weekday, { opensAt: event.target.value });
                    setDirty(true);
                    setProblem(null);
                  }}
                  data-testid={`hours-opens-${weekday}`}
                />

                <span className="faint hours__sep">às</span>

                <input
                  className="input mono hours__time"
                  type="time"
                  aria-label={`${label}: fecha às`}
                  value={day.closesAt}
                  disabled={day.isClosed}
                  onChange={(event) => {
                    hours.updateDay(weekday, { closesAt: event.target.value });
                    setDirty(true);
                    setProblem(null);
                  }}
                  data-testid={`hours-closes-${weekday}`}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <SaveBar
        isSaving={hours.isSaving}
        isDirty={dirty}
        savedAt={hours.savedAt}
        errorMessage={problem ?? hours.errorMessage}
        onSave={() => void handleSave()}
      />
    </form>
  );
}
