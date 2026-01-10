// Calcular datas de início e fim do plano
const calculatePlanDates = (duration, durationUnit) => {
  const startDate = new Date();
  const endDate = new Date();

  switch (durationUnit) {
    case 'days':
      endDate.setDate(endDate.getDate() + duration);
      break;
    case 'months':
      endDate.setMonth(endDate.getMonth() + duration);
      break;
    case 'years':
      endDate.setFullYear(endDate.getFullYear() + duration);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + duration);
  }

  return {
    startDate,
    endDate,
  };
};

module.exports = calculatePlanDates;

