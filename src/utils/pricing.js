// Simple pricing utility for tour guide booking
// In a real system, this could query dynamic rates or apply promotions

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const calculateDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end - start) / MS_PER_DAY);
  return Math.max(diff, 1);
};

const calculateTourGuidePrice = ({ startDate, endDate, baseDailyRate = 100 }) => {
  const days = calculateDays(startDate, endDate);
  return {
    days,
    total: days * baseDailyRate,
  };
};

module.exports = {
  calculateTourGuidePrice,
};
