/** @param {NS} ns */
import { get_all_servers } from "utility.js"
import { install_hacks } from "utility.js"
export async function main(ns: NS) {
  //Note: Functions mutate variables
  ns.disableLog("ALL")

  ns.ui.openTail()

  while (true) {
    //opens ports gain access and nuke
    install_hacks(ns)

    interface ThreadState {
      hack: { required: number, current: number },
      grow: { required: number, current: number },
      weaken: { required: number, current: number },
    }

    //target server
    const script_ram = {
      hack_ram: ns.getScriptRam("hack.js", "home"),
      grow_ram: ns.getScriptRam("grow.js", "home"),
      weaken_ram: ns.getScriptRam("weaken.js", "home")
    }

    const CONFIG = {
      HOME_RAM_RESERVE: 10,
      WEAKEN_BUFFER_MULTIPLIER: 1.05,
      TARGET_HACK_PERCENT: 0.05,
      MONEY_RESTART_THRESHOLD: 0.75,
      QUALITY_CALC_LEVEL_THRESHOLD: 300,
      SCRIPT_LIMIT: 3000 //4000 But just to be safe
    }

    const servers = {
      all: get_all_servers(ns),
      available: [] as string[]
    }

    const state = {
      is_playing: true,
      longest_time: -1,
      script_amount: 0,

      threads: {
        hack: { required: 0, current: 0 },
        grow: { required: 0, current: 0 },
        weaken: { required: 0, current: 0 },
      },

      target: {
        server: "",
        quality: 0
      }
    }

    let is_playing = true

    servers.available = create_available_servers(servers.all)

    state.target = check_server_quality(servers.available)

    await prep()
    await main_hack()

    async function prep() {
      ns.print("\nChecking Prep for " + state.target.server)

      //set server to max money and weaken to min_sec
      while (is_server_prepped(state.target.server) === false) {
        print_server_values(state.target.server)

        const thread_state = calc_threads(state.target.server, true)
        state.threads = thread_state.threads
        state.longest_time = thread_state.longest_time

        ns.print("PrepHacking: " + state.target.server)

        const allocated_results = execute_batch(servers.available)
        if (allocated_results != undefined){
          state.threads.hack.current = allocated_results.current_threads_count.hack
          state.threads.grow.current = allocated_results.current_threads_count.grow
          state.threads.weaken.current = allocated_results.current_threads_count.weaken
          state.script_amount = allocated_results.script_counter
          print_threads()
        }

        const total_threads = calculate_total_threads(state.threads)

        ns.print("Threads: " + total_threads.current + "/" + total_threads.required)
        if (total_threads.required == total_threads.current) {
          ns.print("Successful Prep")
        } else {
          ns.print("Prepping more. Missing " + (total_threads.required - total_threads.current) + " threads.")
        }

        //wait to finish
        ns.print("allocated time: " + ns.tFormat(state.longest_time))
        await ns.sleep(state.longest_time + 1000)
        const reset = reset_loop_variables()
        state.longest_time = reset.longest_time
        state.threads = reset.threads
        state.script_amount = reset.script_amount
      }
    }

    async function main_hack() {
      let current_loop = 0
      reset_loop_variables()
      ns.print("\nStarting Hack")
      //@ignore-infinite
      while (true) {
        ns.print("\nCurrent_loop: " + current_loop + " for " + state.target.server)
        const thread_state = calc_threads(state.target.server, false)
        state.threads = thread_state.threads
        state.longest_time = thread_state.longest_time

        print_server_values(state.target.server)

        ns.print("Hacking...")
        const allocated_results = execute_batch(servers.available)
        if (allocated_results != undefined){
          state.threads.hack.current = allocated_results.current_threads_count.hack
          state.threads.grow.current = allocated_results.current_threads_count.grow
          state.threads.weaken.current = allocated_results.current_threads_count.weaken
          state.script_amount = allocated_results.script_counter
          print_threads()
        }

        const total_threads = calculate_total_threads(state.threads)

        if (total_threads.required === total_threads.current) {
          ns.print("Successful hack")
        } else {
          ns.print("Failed hack")
          ns.print("Duration: " + ns.tFormat(state.longest_time))
          await ns.sleep(state.longest_time + 1000)
          ns.toast("Starting next Batch Cycle")
        }

        const reset = reset_loop_variables()
        state.longest_time = reset.longest_time
        state.threads = reset.threads
        state.script_amount = reset.script_amount

        current_loop += 1

        if ((ns.getServerMoneyAvailable(state.target.server) / ns.getServerMaxMoney(state.target.server)) < CONFIG.MONEY_RESTART_THRESHOLD) {
          restart()
        }

        if (is_playing == false) {
          ns.tprint("Restarting... \n")
          ns.toast("Restarting... \n")
          break
        }
      }
    }

    function is_server_prepped(passed_server: string) {
      const max_money = ns.getServerMaxMoney(passed_server)
      const money = ns.getServerMoneyAvailable(passed_server)
      const min_sec = ns.getServerMinSecurityLevel(passed_server)
      const sec_level = ns.getServerSecurityLevel(passed_server)

      return max_money === money && min_sec === sec_level
    }

    function print_server_values(passed_server: string) {
      ns.print("Money: " + ns.getServerMoneyAvailable(passed_server) + " / " + ns.getServerMaxMoney(passed_server))
      ns.print("Security: " + ns.getServerSecurityLevel(passed_server) + " / " + ns.getServerMinSecurityLevel(passed_server))
    }

    function print_threads() {
      ns.print("Amount of threads: " + (state.threads.hack.required + state.threads.grow.required + state.threads.weaken.required))
      ns.print("Amount of Hack Thread: " + state.threads.hack.required)
      ns.print("Amount of Grow Thread: " + state.threads.grow.required)
      ns.print("Amount of Weaken Thread: " + state.threads.weaken.required)
      ns.print("Total script usage: " + state.script_amount)
    }

    //set a boolean to break out of all loops
    function restart() {
      is_playing = false
    }

    function calculate_total_threads(threads: ThreadState) {
      return {
        required: threads.hack.required + threads.grow.required + threads.weaken.required,
        current: threads.hack.current + threads.grow.current + threads.weaken.current
      }
    }

    function reset_loop_variables() {
      return {
        longest_time: -1,
        threads: {
          hack: { required: 0, current: 0 },
          grow: { required: 0, current: 0 },
          weaken: { required: 0, current: 0 }
        },
        script_amount: 0
      }
    }

    function create_available_servers(passed_servers: string[]) {
      let hackable_servers = []
      for (const server of passed_servers) {
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server) && ns.hasRootAccess(server)) {
          hackable_servers.push(server)
        }
      }
      return hackable_servers
    }

    function check_server_quality(passed_servers: string[]) {
      let target_server = {
        server: state.target.server,
        quality: state.target.quality
      }
      for (const server of passed_servers) {
        //check if its at least half my level or if its level 0...
        if (ns.getHackingLevel() / 2 >= ns.getServerRequiredHackingLevel(server) || ns.getServerRequiredHackingLevel(server) == 0) {
          //calculate based on how good it gets
          let growth_amount = ns.getServerGrowth(server)
          let max_money = ns.getServerMaxMoney(server)
          let min_security = ns.getServerMinSecurityLevel(server)

          let server_quality
          if (ns.getHackingLevel() < CONFIG.QUALITY_CALC_LEVEL_THRESHOLD) {
            server_quality = (growth_amount * max_money) / min_security
          } else {
            server_quality = max_money / min_security
          }
          //ns.tprint(server + " quality: " + server_quality.toLocaleString("en-US"))

          //doesn't account for equal quality
          if (target_server.quality < server_quality) {
            target_server.quality = server_quality
            target_server.server = server
          }
        }
      }
      return target_server
    }


    function calc_threads(passed_server: string, is_prep: boolean) {
      const return_state = {
        longest_time: state.longest_time,
        threads: {
          hack: { required: 0, current: 0 },
          grow: { required: 0, current: 0 },
          weaken: { required: 0, current: 0 }
        }
      }
      //check for the longest time
      let grow_time = ns.getGrowTime(passed_server)
      let hack_time = ns.getHackTime(passed_server)
      let weaken_time = ns.getWeakenTime(passed_server)
      let max_time = Math.max(grow_time, hack_time, weaken_time)

      //comes from outside of the function
      return_state.longest_time = max_time

      if (is_prep) {
        //get amount of threads needed //its okay I didn't pass something in
        let grow_threads = calc_grow_threads(passed_server)
        let weaken_threads = calc_weaken_threads(passed_server)
        weaken_threads += Math.ceil(ns.growthAnalyzeSecurity(grow_threads, passed_server) / ns.weakenAnalyze(1))


        //comes from outside of the function
        return_state.threads.grow.required = grow_threads
        return_state.threads.weaken.required = Math.ceil(weaken_threads * CONFIG.WEAKEN_BUFFER_MULTIPLIER)

      }
      else if (!is_prep) {
        //calculate threads needed
        let hack_threads = calc_hack_threads(passed_server, CONFIG.TARGET_HACK_PERCENT)
        let grow_threads = calc_grow_threads(passed_server, CONFIG.TARGET_HACK_PERCENT)
        let weaken_threads = Math.ceil((ns.hackAnalyzeSecurity(hack_threads, passed_server)) + (ns.growthAnalyzeSecurity(grow_threads, passed_server, 1)) / ns.weakenAnalyze(1))

        //comes from outside of the function
        return_state.threads.hack.required = hack_threads
        return_state.threads.grow.required = grow_threads
        return_state.threads.weaken.required = Math.ceil(weaken_threads * CONFIG.WEAKEN_BUFFER_MULTIPLIER)
      }
      return return_state
    }

    function execute_batch(passed_servers: string[]) {
      const allocated_results = allocate_threads(passed_servers)
      //TODO: if allocated scripts is higher than 3k don't do it.
      //do this by checking the next batch for it
      //since you're already based on the required threads
      //you can check how big it is
      if (allocated_results.script_counter < CONFIG.SCRIPT_LIMIT){
        execute_threads(allocated_results.allocated_threads)
        return allocated_results
      }else{
        return undefined
      }
    }

    function allocate_threads(passed_servers: string[]) {
      const allocated_result = {
        allocated_threads: {
          hack: [] as Array<{ server: string, amount: number }>,
          grow: [] as Array<{ server: string, amount: number }>,
          weaken: [] as Array<{ server: string, amount: number }>
        },

        current_threads_count: {
          hack: 0,
          grow: 0,
          weaken: 0
        },

        script_counter: count_number_of_scripts_servers(passed_servers)
      }
      //if too much ram don't do it
      if (calculate_ram_from_required_threads() < calculate_servers_available_ram(passed_servers)){
        for (const server of passed_servers) {
          let server_available_ram = calculate_server_available_ram(server)
          
          if (server_available_ram > script_ram.hack_ram && state.threads.hack.required - allocated_result.current_threads_count.hack > 0) {
            const possible_thread_amount = Math.floor(server_available_ram / script_ram.hack_ram)
            const threads_to_use = Math.min(possible_thread_amount, state.threads.hack.required - allocated_result.current_threads_count.hack)
            allocated_result.current_threads_count.hack += threads_to_use
            server_available_ram -= threads_to_use * script_ram.hack_ram
            allocated_result.allocated_threads.hack.push({ server, amount: threads_to_use })
            allocated_result.script_counter += 1
          }
          
          if (server_available_ram > script_ram.grow_ram && state.threads.grow.required - allocated_result.current_threads_count.grow > 0) {
            const possible_thread_amount = Math.floor(server_available_ram / script_ram.grow_ram)
            const threads_to_use = Math.min(possible_thread_amount, state.threads.grow.required - allocated_result.current_threads_count.grow)
            allocated_result.current_threads_count.grow += threads_to_use
            server_available_ram -= threads_to_use * script_ram.grow_ram
            allocated_result.allocated_threads.grow.push({ server, amount: threads_to_use })
            allocated_result.script_counter += 1
          }
          
          if (server_available_ram > script_ram.weaken_ram && state.threads.weaken.required - allocated_result.current_threads_count.weaken > 0) {
            const possible_thread_amount = Math.floor(server_available_ram / script_ram.weaken_ram)
            const threads_to_use = Math.min(possible_thread_amount, state.threads.weaken.required - allocated_result.current_threads_count.weaken)
            allocated_result.current_threads_count.weaken += threads_to_use
            allocated_result.allocated_threads.weaken.push({ server, amount: threads_to_use })
            allocated_result.script_counter += 1
          }
        }
      }
      return allocated_result
    }

    function count_number_of_scripts_servers(servers: string[]) {
      let current_script_counter = 0
      for (const server of servers) {
        current_script_counter += ns.ps(server).length
      }
      return current_script_counter
    }

    function execute_threads(allocated_threads: any) {
      for (const thread of allocated_threads.hack) {
        ns.exec("hack.js", thread.server, thread.amount, state.target.server, state.longest_time - ns.getHackTime(state.target.server))
      }

      for (const thread of allocated_threads.grow) {
        ns.exec("grow.js", thread.server, thread.amount, state.target.server, state.longest_time - ns.getGrowTime(state.target.server))
      }

      for (const thread of allocated_threads.weaken) {
        ns.exec("weaken.js", thread.server, thread.amount, state.target.server, state.longest_time - ns.getWeakenTime(state.target.server) + 20)
      }
    }

    function calculate_ram_from_required_threads() {
      let total_cost = 0
      total_cost += state.threads.hack.required * script_ram.hack_ram
      total_cost += state.threads.grow.required * script_ram.grow_ram
      total_cost += state.threads.weaken.required * script_ram.weaken_ram
      return total_cost
    }

    function calculate_server_available_ram(server: string) {
      return ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    }

    function calculate_servers_available_ram(servers: string[]) {
      let total_available_ram = 0
      for (const server of servers) {
        total_available_ram += ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
      }
      return total_available_ram
    }

    function calc_hack_threads(passed_target: string, passed_pecentage: number) {
      const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)

      return Math.ceil(ns.hackAnalyzeThreads(passed_target, money * passed_pecentage))
    }

    function calc_grow_threads(passed_target: string, passed_pecentage: number = 0) {
      const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)
      const max_money = ns.getServerMaxMoney(passed_target)

      const target_percent = passed_pecentage ? 1 / (1 - passed_pecentage) : (max_money / money)

      return Math.ceil(ns.growthAnalyze(passed_target, target_percent))
    }

    function calc_weaken_threads(passed_target: string) {
      const min_sec = ns.getServerMinSecurityLevel(passed_target)
      const sec = ns.getServerSecurityLevel(passed_target)
      const weaken_threads = Math.ceil((sec - min_sec) / ns.weakenAnalyze(1, 1))

      return weaken_threads
    }
  }
}
