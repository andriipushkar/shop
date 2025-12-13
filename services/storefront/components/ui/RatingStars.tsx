'use client';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showLabel?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

const RATING_LABELS: Record<number, string> = {
  5: 'Відмінно',
  4: 'Добре',
  3: 'Нормально',
  2: 'Погано',
  1: 'Жахливо',
};

export default function RatingStars({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showLabel = false,
}: RatingStarsProps) {
  const sizeClass = SIZE_CLASSES[size];

  const handleStarClick = (value: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= rating;

          return (
            <button
              key={index}
              type={interactive ? 'button' : undefined}
              onClick={() => handleStarClick(starValue)}
              disabled={!interactive}
              className={`${
                interactive
                  ? 'cursor-pointer hover:scale-110 transition-transform'
                  : 'cursor-default'
              } focus:outline-none`}
            >
              <svg
                className={`${sizeClass} ${
                  isFilled ? 'text-yellow-400 fill-current' : 'text-gray-300'
                }`}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
      </div>
      {showLabel && rating > 0 && (
        <span className="text-sm text-gray-600">{RATING_LABELS[rating]}</span>
      )}
    </div>
  );
}
