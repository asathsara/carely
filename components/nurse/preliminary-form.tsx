export function PreliminaryForm() {
  return (
    <fieldset id="preliminary" className="mt-7 space-y-4 border-t pt-6">
      <legend className="text-lg font-semibold">Preliminary records</legend>
      <div>
        <label htmlFor="complaint" className="mb-2 block text-sm font-semibold">
          Initial complaint
        </label>
        <textarea
          id="complaint"
          name="complaint"
          required
          maxLength={2000}
          className="bg-carely-surface focus-visible:ring-primary/40 min-h-24 w-full rounded-lg border p-3 outline-none focus-visible:ring-2"
        />
      </div>
      <div>
        <label htmlFor="preliminaryNote" className="mb-2 block text-sm font-semibold">
          Nursing observations
        </label>
        <textarea
          id="preliminaryNote"
          name="preliminaryNote"
          required
          maxLength={5000}
          className="bg-carely-surface focus-visible:ring-primary/40 min-h-32 w-full rounded-lg border p-3 outline-none focus-visible:ring-2"
        />
      </div>
    </fieldset>
  );
}
