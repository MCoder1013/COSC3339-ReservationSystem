import './App.css';

export type ReviewRecord = {
  id: number;
  rating: number;
  review: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_email?: string | null;
  reservation_id?: number | null;
  package_event_id?: number | null;
  cruise_name?: string | null;
  ship_name?: string | null;
  cabin_number?: string | null;
  event_name?: string | null;
};

type Props = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  reviews: ReviewRecord[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  onClose: () => void;
};

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join(' ');
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildMetaLine(review: ReviewRecord) {
  const parts: string[] = [];

  if (review.cruise_name) {
    parts.push(`Cruise: ${review.cruise_name}`);
  }

  if (review.ship_name) {
    parts.push(`Ship: ${review.ship_name}`);
  }

  if (review.cabin_number) {
    parts.push(`Cabin: ${review.cabin_number}`);
  }

  if (review.event_name) {
    parts.push(`Event: ${review.event_name}`);
  }

  return parts.join(' · ');
}

export default function ReviewsModal({
  isOpen,
  title,
  subtitle,
  reviews,
  loading = false,
  error = '',
  emptyMessage = 'No reviews have been posted yet.',
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent reviewsModalContent" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader reviewsModalHeader">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="reviewsModalSubtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close reviews popup">
            ✕
          </button>
        </div>

        <div className="reviewsModalBody">
          {loading && <p className="reviewsModalState">Loading reviews...</p>}
          {!loading && error && <p className="reviewsModalState reviewsModalError">{error}</p>}
          {!loading && !error && reviews.length === 0 && <p className="reviewsModalState">{emptyMessage}</p>}

          {!loading && !error && reviews.length > 0 && (
            <div className="reviewsList">
              {reviews.map((review) => (
                <article key={review.id} className="reviewEntryCard">
                  <div className="reviewEntryTop">
                    <div>
                      <h4>{review.reviewer_name}</h4>
                      <p className="reviewEntryMeta">{formatDate(review.created_at)}</p>
                      {buildMetaLine(review) && <p className="reviewEntryMeta">{buildMetaLine(review)}</p>}
                    </div>
                    <span className="reviewEntryStars" aria-label={`${review.rating} out of 5 stars`}>
                      {renderStars(review.rating)}
                    </span>
                  </div>
                  {review.review ? (
                    <p className="reviewEntryText">{review.review}</p>
                  ) : (
                    <p className="reviewEntryText reviewEntryMuted">No written review was added.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}