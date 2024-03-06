import { useContract, useProvider } from '@/composables'
import { CONTRACT_IDS, NETWORK_IDS, ROUTE_NAMES } from '@/enums'
import { sleep } from '@/helpers'
import { useRouter } from '@/router'
import { type BigNumber, type Provider } from '@/types'
import { config } from '@config'
import { providers } from 'ethers'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import {
  FallbackEvmProvider,
  MetamaskProvider,
  ProviderDetector,
  PROVIDERS,
  type ProviderProxyConstructor,
} from '@distributedlab/w3p'

enum BALANCE_CURRENCIES {
  stEth = 'stEth',
  mor = 'mor',
}

export enum SUPPORTED_PROVIDERS {
  Metamask = PROVIDERS.Metamask,
  Fallback = PROVIDERS.Fallback,
}

const STORE_NAME = 'web3-providers-store'

const SUPPORTED_PROXY_CONSTRUCTORS: Record<
  SUPPORTED_PROVIDERS,
  ProviderProxyConstructor
> = {
  [SUPPORTED_PROVIDERS.Fallback]: FallbackEvmProvider,
  [SUPPORTED_PROVIDERS.Metamask]: MetamaskProvider,
}

export const useWeb3ProvidersStore = defineStore(
  STORE_NAME,
  () => {
    const _router = reactive(useRouter())

    // State
    const provider = reactive(useProvider())

    const balances = reactive<Record<BALANCE_CURRENCIES, BigNumber | null>>({
      [BALANCE_CURRENCIES.stEth]: null,
      [BALANCE_CURRENCIES.mor]: null,
    })

    const isAddingToken = ref(false)
    const hasConnectedProvider = ref(false)

    // Getters
    const networkId = computed<NETWORK_IDS>(() => {
      if (
        _router.currentRoute.matched.find(
          route => route.name === ROUTE_NAMES.appMainnet,
        )
      )
        return NETWORK_IDS.mainnet

      return NETWORK_IDS.testnet
    })

    const defaultProvider = computed<Provider>(() => {
      if (String(provider.chainId) === config.networks[networkId.value].chainId)
        return new providers.Web3Provider(
          provider.rawProvider as providers.ExternalProvider,
        )

      return config.networks[networkId.value].provider
    })

    const isValidChain = computed<boolean>(() => {
      return (
        isAddingToken.value ||
        String(provider.chainId) === config.networks[networkId.value].chainId
      )
    })

    const isConnected = computed<boolean>(
      () => provider.isConnected && hasConnectedProvider.value,
    )

    const address = computed<string>(() => provider.selectedAddress)

    const erc1967ProxyContract = computed(() =>
      useContract(
        'ERC1967Proxy__factory',
        config.networks[networkId.value].contractAddressesMap[
          CONTRACT_IDS.erc1967Proxy
        ],
        defaultProvider.value,
      ),
    )

    const stEthContract = computed(() =>
      useContract(
        'ERC20__factory',
        config.networks[networkId.value].contractAddressesMap[
          CONTRACT_IDS.stEth
        ],
        defaultProvider.value,
      ),
    )

    const morContract = computed(() =>
      useContract(
        'ERC20__factory',
        config.networks[networkId.value].contractAddressesMap[CONTRACT_IDS.mor],
        config.networks[networkId.value].extendedChainProvider,
      ),
    )

    const endpointContract = computed(() =>
      useContract(
        'Endpoint__factory',
        config.networks[networkId.value].contractAddressesMap[
          CONTRACT_IDS.endpoint
        ],
        defaultProvider.value,
      ),
    )

    // Actions
    const init = async () => {
      const providerDetector = new ProviderDetector()
      await providerDetector.init()

      if (providerDetector.providers.metamask)
        await provider.init(
          SUPPORTED_PROXY_CONSTRUCTORS[SUPPORTED_PROVIDERS.Metamask],
        )

      // store requires time for sync with vue-router
      await sleep(1000)
    }

    return {
      // State
      provider,
      balances,
      isAddingToken,
      hasConnectedProvider,

      // Getters
      networkId,
      defaultProvider,
      isValidChain,
      isConnected,
      address,
      erc1967ProxyContract,
      stEthContract,
      morContract,
      endpointContract,

      // Actions
      init,
    }
  },
  { persist: { paths: ['hasConnectedProvider'] } },
)