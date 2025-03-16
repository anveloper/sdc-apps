import { Drawer } from 'antd';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useAtomValue } from 'jotai';
import { objectEntries } from '@toss/utils';
import { isStockOverLimit } from 'shared~config/dist/stock';
import { ImpressionArea } from '@toss/impression-area';
import { MessageInstance } from 'antd/es/message/interface';
import { MEDIA_QUERY } from '../../../../../../config/common';
import InfoHeader from '../../../../../../component-presentation/InfoHeader';
import {
  calculateAveragePurchasePrice,
  calculateProfitRate,
  getAnimalImageSource,
  renderProfitBadge,
} from '../../../../../../utils/stock';
import MessageBalloon from '../../../../../../component-presentation/MessageBalloon';
import StockLineChart from '../../../../../../component-presentation/StockLineChart';
import ButtonGroup from '../../../../../../component-presentation/ButtonGroup';
import { Query } from '../../../../../../hook';
import { UserStore } from '../../../../../../store';

interface Props {
  drawerOpen: boolean;
  handleCloseDrawer: () => void;
  selectedCompany: string;
  stockMessages: string[];
  priceData: Record<string, number[]>;
  stockId: string;
  messageApi: MessageInstance;
}

const StockDrawer = ({
  drawerOpen,
  handleCloseDrawer,
  selectedCompany,
  stockMessages,
  priceData,
  stockId,
  messageApi,
}: Props) => {
  const isDesktop = useMediaQuery({ query: MEDIA_QUERY.DESKTOP });
  const supabaseSession = useAtomValue(UserStore.supabaseSession);
  const userId = supabaseSession?.user.id;

  const { isFreezed, user, refetch } = Query.Stock.useUser({
    stockId,
    userId,
  });
  const {
    data: stock,
    companiesPrice,
    timeIdx,
  } = Query.Stock.useQueryStock(stockId, { refetchInterval: Number.POSITIVE_INFINITY });
  const { data: userCount } = Query.Stock.useUserCount({ stockId });

  const [isVisible, setIsVisible] = useState(() => Boolean(selectedCompany));
  const prevIsVisibleRef = useRef(isVisible);

  const { data: logs } = Query.Stock.useQueryLog(
    { company: selectedCompany, round: stock?.round, stockId, userId },
    {
      enabled: isVisible,
    },
  );

  // logs 변화를 감지하여 메시지 표시
  const prevLogsRef = useRef<Record<string, typeof logs>>({});

  if (isVisible !== prevIsVisibleRef.current) {
    if (isVisible) {
      prevLogsRef.current[selectedCompany] = logs;
    }
    prevIsVisibleRef.current = isVisible;
  }

  useEffect(() => {
    if (!logs || logs.length === 0) return;

    // 이전 로그와 현재 로그의 길이를 비교하여 새로운 로그가 추가되었는지 확인
    if (prevLogsRef.current && logs.length > prevLogsRef.current[selectedCompany]?.length) {
      refetch();

      // 가장 최근 로그 확인
      const latestLog = logs[logs.length - 1];

      if (latestLog) {
        if (latestLog.failedReason) {
          messageApi.destroy();
          messageApi.open({
            content: latestLog.failedReason,
            duration: 2,
            type: 'error',
          });
        } else if (latestLog.action === 'BUY') {
          messageApi.destroy();
          messageApi.open({
            content: `주식을 구매하였습니다.`,
            duration: 2,
            type: 'success',
          });
        } else if (latestLog.action === 'SELL') {
          messageApi.destroy();
          messageApi.open({
            content: `주식을 ${latestLog.quantity}주 판매하였습니다.`,
            duration: 2,
            type: 'success',
          });
        }
      }
    }

    // 현재 로그를 저장
    prevLogsRef.current[selectedCompany] = logs;
  }, [logs, messageApi, refetch, selectedCompany]);

  const { mutateAsync: buyStock, isLoading: isBuyLoading } = Query.Stock.useBuyStock();
  const { mutateAsync: sellStock, isLoading: isSellLoading } = Query.Stock.useSellStock();

  const 보유주식 = useMemo(() => {
    return objectEntries(user?.inventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([company, count]) => ({
        company,
        count,
      }));
  }, [user?.inventory]);

  const prevAveragePurchasePrice = useRef<number>();
  const averagePurchasePrice = useMemo(() => {
    return calculateAveragePurchasePrice({
      company: selectedCompany,
      currentQuantity: 보유주식.find(({ company }) => company === selectedCompany)?.count ?? 0,
      logs,
      prevData: prevAveragePurchasePrice.current,
      round: stock?.round,
    });
  }, [logs, selectedCompany, stock?.round, 보유주식]);

  if (averagePurchasePrice !== prevAveragePurchasePrice.current) {
    prevAveragePurchasePrice.current = averagePurchasePrice;
  }

  const stockProfitRate = useMemo(
    () =>
      selectedCompany && 보유주식.find(({ company }) => company === selectedCompany)
        ? calculateProfitRate(companiesPrice[selectedCompany], averagePurchasePrice)
        : null,
    [averagePurchasePrice, companiesPrice, selectedCompany, 보유주식],
  );

  const chartPriceData = useMemo(
    () => (selectedCompany ? priceData[selectedCompany].slice(0, (timeIdx ?? 0) + 1) : [100000]),
    [priceData, selectedCompany, timeIdx],
  );

  if (!stock || !userId || !user) {
    return <>불러오는 중</>;
  }

  const onClickBuy = (company: string) => {
    buyStock({ amount: 1, company, round: stock.round, stockId, unitPrice: companiesPrice[company], userId });
    // .then(() => {
    //   messageApi.destroy();
    //   messageApi.open({
    //     content: '주식을 구매하였습니다.',
    //     duration: 2,
    //     type: 'success',
    //   });
    // })
    // .catch((reason: Error) => {
    //   messageApi.destroy();
    //   messageApi.open({
    //     content: `${reason.message}`,
    //     duration: 2,
    //     type: 'error',
    //   });
    // });
  };

  const onClickSell = (company: string, amount = 1) => {
    sellStock({ amount, company, round: stock.round, stockId, unitPrice: companiesPrice[company], userId });
    // .then(() => {
    //   messageApi.destroy();
    //   messageApi.open({
    //     content: `주식을 ${amount > 1 ? `${amount}주 ` : ''}판매하였습니다.`,
    //     duration: 2,
    //     type: 'success',
    //   });
    // })
    // .catch((reason: Error) => {
    //   messageApi.destroy();
    //   messageApi.open({
    //     content: `${reason.message}`,
    //     duration: 2,
    //     type: 'error',
    //   });
    // });
  };

  const isLoading = isBuyLoading || isFreezed || isSellLoading;
  const isDisabled = timeIdx === undefined || timeIdx >= 9 || !stock.isTransaction || isLoading;

  const remainingStock = stock.remainingStocks[selectedCompany];
  const isBuyable = user.money >= companiesPrice[selectedCompany];
  const isRemainingStock = Boolean(remainingStock);
  const isCanBuy = isBuyable && isRemainingStock;

  return (
    <Drawer
      placement="bottom"
      onClose={handleCloseDrawer}
      open={drawerOpen}
      height="auto"
      closeIcon={false}
      afterOpenChange={(visible) => {
        if (visible) {
          const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 300);
          return () => clearTimeout(timer);
        }
        return () => {};
      }}
      styles={{
        body: {
          padding: '28px 0 0 0',
        },
        content: {
          backgroundColor: '#252836',
          borderRadius: '16px 16px 0 0',
          margin: '0 auto',
          maxWidth: isDesktop ? '400px' : '100%',
        },
        header: {
          padding: '0',
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      <InfoHeader
        title={selectedCompany.slice(0, 4)}
        subtitle={`보유 주식: ${보유주식.find(({ company }) => company === selectedCompany)?.count ?? 0}`}
        subTitleColor={
          isStockOverLimit(
            userCount?.count ?? Number.NEGATIVE_INFINITY,
            보유주식.find(({ company }) => company === selectedCompany)?.count ?? 0,
            1,
          ) || !isRemainingStock
            ? 'red'
            : '#d1d5db'
        }
        value={selectedCompany ? companiesPrice[selectedCompany] : 0}
        valueFormatted={`${selectedCompany ? companiesPrice[selectedCompany].toLocaleString() : 0}원`}
        valueColor={isBuyable ? 'white' : 'red'}
        badge={renderProfitBadge(stockProfitRate)}
        src={getAnimalImageSource(selectedCompany)}
        width={50}
      />
      <MessageBalloon messages={stockMessages} />
      <ImpressionArea onImpressionStart={() => setIsVisible(true)} onImpressionEnd={() => setIsVisible(false)}>
        <StockLineChart
          company={selectedCompany}
          priceData={chartPriceData}
          fluctuationsInterval={stock.fluctuationsInterval}
          averagePurchasePrice={averagePurchasePrice}
        />
      </ImpressionArea>
      <ButtonGroup
        buttons={[
          {
            backgroundColor: '#007aff',
            disabled:
              isDisabled ||
              !isCanBuy ||
              isStockOverLimit(
                userCount?.count ?? Number.NEGATIVE_INFINITY,
                보유주식.find(({ company }) => company === selectedCompany)?.count ?? 0,
                1,
              ),
            flex: 1,
            onClick: () => onClickBuy(selectedCompany),
            text: '사기',
          },
          {
            backgroundColor: '#f63c6b',
            disabled: isDisabled || !user.inventory[selectedCompany],
            flex: 1,
            onClick: () => onClickSell(selectedCompany),
            text: '팔기',
          },
        ]}
        direction="row"
        padding="0 16px 8px 16px"
      />
      <ButtonGroup
        buttons={[
          {
            backgroundColor: '#374151',
            disabled: isDisabled || !user.inventory[selectedCompany],
            onClick: () =>
              onClickSell(selectedCompany, 보유주식.find(({ company }) => company === selectedCompany)?.count),
            text: '모두 팔기',
          },
        ]}
        padding="0 16px 12px 16px"
      />
    </Drawer>
  );
};

export default StockDrawer;
