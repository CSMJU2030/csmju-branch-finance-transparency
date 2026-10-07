/** Result of the last form action, passed back to the page as ?ok= / ?error= (no client JS needed). */
export default function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-body-md text-emerald-700">
        {ok}
      </p>
    );
  }
  return null;
}
