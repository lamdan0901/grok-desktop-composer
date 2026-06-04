import { AlertCircle } from "lucide-react";
import { formatErrorForDisplay } from "@/lib/formatErrorMessage";

interface ErrorBlockProps {
  content: string;
}

export function ErrorBlock({ content }: ErrorBlockProps) {
  const { title, message, details, compact } = formatErrorForDisplay(content);

  return (
    <div
      className={`error-block${compact ? " error-block--compact" : ""}`}
      role="alert"
    >
      <div className="error-block__header">
        <AlertCircle size={15} className="error-block__icon" aria-hidden />
        <span className="error-block__title">{title}</span>
      </div>
      {!compact && message && (
        <p className="error-block__message">{message}</p>
      )}
      {!compact && details.length > 0 && (
        <dl className="error-block__details">
          {details.map(({ label, value }) => (
            <div key={label} className="error-block__row">
              <dt className="error-block__label">{label}</dt>
              <dd className="error-block__value" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}