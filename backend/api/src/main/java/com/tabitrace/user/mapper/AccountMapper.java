package com.tabitrace.user.mapper;

import org.apache.ibatis.annotations.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 账户概览：设置中心左侧的旅行统计与 Trip Pro 状态，全部来自真实记录 */
@Mapper
public interface AccountMapper {
    @Select("SELECT COUNT(*) FROM trips WHERE user_id=#{userId}") int countTrips(Long userId);
    /** 记录过的地点：官方地点按 place_id 去重，自定义地点按名称去重 */
    @Select("SELECT COUNT(DISTINCT COALESCE(CONCAT('p', place_id), CONCAT('n', place_name_snapshot))) FROM checkins WHERE user_id=#{userId}") int countPlaces(Long userId);
    @Select("SELECT COUNT(*) FROM photos WHERE user_id=#{userId}") int countPhotos(Long userId);
    @Select("SELECT COUNT(*) FROM trips WHERE user_id=#{userId} AND plan_type='FREE' AND status<>'ARCHIVED'") int countActiveFreeTrips(Long userId);

    class TripPlanRow { public Long tripId; public String title; public String destinationName; public LocalDate startDate; public LocalDate endDate; public String planType; public String status;
                        public Integer amount; public String currency; public String provider; public LocalDateTime paidAt; }

    /** 每段旅行的方案；Pro 旅行附带最近一次成功支付（没有支付记录时为空） */
    @Select("""
        SELECT t.id AS trip_id, t.title, t.destination_name, t.start_date, t.end_date, t.plan_type, t.status,
               p.amount, p.currency, p.provider, p.paid_at
        FROM trips t
        LEFT JOIN payments p ON p.id = (SELECT MAX(p2.id) FROM payments p2 WHERE p2.trip_id = t.id AND p2.status = 'PAID')
        WHERE t.user_id = #{userId}
        ORDER BY t.start_date DESC, t.id DESC
        """)
    List<TripPlanRow> tripPlans(Long userId);
}
