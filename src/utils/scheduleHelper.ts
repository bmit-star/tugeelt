export interface SeasonScheduleInfo {
  seasonType: "summer" | "winter";
  seasonLabel: string;
  monthsRange: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  morningReminderTime: string; // 20 mins before start
  eveningReminderTime: string; // 20 mins before end
}

/**
 * Calculates season schedule based on business rules:
 * - 4-8 сар (April to August): 08:00 - 17:00
 * - 9-3 сар (September to March): 09:00 - 18:00
 */
export function getSeasonSchedule(dateObj: Date = new Date()): SeasonScheduleInfo {
  const month = dateObj.getMonth() + 1; // 1 to 12

  // 4, 5, 6, 7, 8 -> 4-8 сард
  const isSummer = month >= 4 && month <= 8;

  if (isSummer) {
    return {
      seasonType: "summer",
      seasonLabel: "Дулааны улирал (4-8 сар)",
      monthsRange: "4-р сараас 8-р сар дуустал",
      startHour: 8,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      startTimeFormatted: "08:00",
      endTimeFormatted: "17:00",
      morningReminderTime: "07:40",
      eveningReminderTime: "16:40"
    };
  } else {
    return {
      seasonType: "winter",
      seasonLabel: "Хүйтний улирал (9-3 сар)",
      monthsRange: "9-р сараас 3-р сар дуустал",
      startHour: 9,
      startMinute: 0,
      endHour: 18,
      endMinute: 0,
      startTimeFormatted: "09:00",
      endTimeFormatted: "18:00",
      morningReminderTime: "08:40",
      eveningReminderTime: "17:40"
    };
  }
}

export interface ReminderStatus {
  isMorningReminderWindow: boolean;
  isEveningReminderWindow: boolean;
  isWorkTime: boolean;
  schedule: SeasonScheduleInfo;
  activeAlertMessage?: string;
}

/**
 * Checks current time against 20-minute notification window
 */
export function checkScheduleReminders(currentDate: Date = new Date()): ReminderStatus {
  const schedule = getSeasonSchedule(currentDate);
  const curHours = currentDate.getHours();
  const curMinutes = currentDate.getMinutes();
  const curTotalMinutes = curHours * 60 + curMinutes;

  const startTotalMinutes = schedule.startHour * 60 + schedule.startMinute;
  const endTotalMinutes = schedule.endHour * 60 + schedule.endMinute;

  // Morning reminder window: from 20 mins before start until start + 45 mins
  const morningReminderStart = startTotalMinutes - 20;
  const morningReminderEnd = startTotalMinutes + 45;
  const isMorningReminderWindow = curTotalMinutes >= morningReminderStart && curTotalMinutes <= morningReminderEnd;

  // Evening reminder window: from 20 mins before end until end + 60 mins
  const eveningReminderStart = endTotalMinutes - 20;
  const eveningReminderEnd = endTotalMinutes + 90;
  const isEveningReminderWindow = curTotalMinutes >= eveningReminderStart && curTotalMinutes <= eveningReminderEnd;

  const isWorkTime = curTotalMinutes >= startTotalMinutes && curTotalMinutes <= endTotalMinutes;

  let activeAlertMessage = undefined;
  if (curTotalMinutes >= morningReminderStart && curTotalMinutes < startTotalMinutes) {
    activeAlertMessage = `⏰ 20 минутын сануулга: Өглөөний эхлэх цаг ${schedule.startTimeFormatted} дөхөж байна. Эхлэх ODO заалтаа цагтаа бүртгүүлнэ үү!`;
  } else if (curTotalMinutes >= eveningReminderStart && curTotalMinutes < endTotalMinutes) {
    activeAlertMessage = `⏰ 20 минутын сануулга: Өдрийн ажил дуусах цаг ${schedule.endTimeFormatted} дөхөж байна. Төгсгөх ODO болон түлшээ бөглөж хаана уу!`;
  }

  return {
    isMorningReminderWindow,
    isEveningReminderWindow,
    isWorkTime,
    schedule,
    activeAlertMessage
  };
}
